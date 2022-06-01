import moment from 'moment';
import mongoose from 'mongoose';
import { Ret } from '../utils/ret';
import { TransactionEthereum } from './transaction.model';
import { ETHERSCAN_API_KEY, ETH_DESTINATION_WALLET_ADDRESS, ETHERSCAN_CHAIN_NAME, ETHERSCAN_TIMEOUT } from '../configs';
import { PaymentPurchase, PaymentWhitelistDeal, IPaymentPurchase, PaymentProduct } from './payment.model';
import { User, SafeUserData } from './user.model';


const { promisify } = require('util');
const sleepnow = promisify(setTimeout);


export interface IPurchaseRequest {
    user_data: SafeUserData
    product_sku?: string,
    coupon?: any,
    payment_total_price?: string,
    payment_token?: string
    dry_run?: boolean,
    transaction_hash?: string
    wl_deal_id?:string
}

export class PaymentManager {
    etherscan_api: any;
    constructor() {
        this.etherscan_api = require('etherscan-api').init(ETHERSCAN_API_KEY, ETHERSCAN_CHAIN_NAME, ETHERSCAN_TIMEOUT);
    }

    async handleAndReturnPurchaseOrders(po_list: []) : Promise<Ret> {
        try {
            let purchases = await PaymentPurchase
                    .find( { _id: {$in: po_list} })
                    .sort( { created_at: -1 });

            for (let p of purchases) {
                if (p.status != 'payment_pending') continue;
                this.handlePendingPurchase(p);
                await sleepnow(250);
            }

            purchases = await PaymentPurchase
                    .find( { _id: {$in: po_list} })
                    .sort( { created_at: -1 });

            let hasPendingPurchases = false;
            for (let p of purchases) {
                if (p.status == 'payment_pending') {
                    hasPendingPurchases = true;
                    break;
                }
            }
            return { status: 'success', data: { purchases: purchases, hasPendingPurchases: hasPendingPurchases } };
        } catch (error) {
            return { status: 'error', message: String(error) };
        }

    }

    async handlePendingPurchaseAll() {
        let purchases = await PaymentPurchase.find({ status: 'payment_pending' });

        for (let p of purchases) {
            this.handlePendingPurchase(p);
            await sleepnow(1 * 1000);
        }
    }

    async handlePendingPurchase(p: (IPaymentPurchase & {_id: any;})) {
        let now = moment.utc();

        let user = await User.findOne({_id: p.user_id});
        if ( p.status != 'payment_pending' ) {

            // Already handled, do nothing
            
        } else if ( moment.utc(p.created_at).add(6, "hours").isBefore(now) ) {

            // Handle expired payments

            await PaymentPurchase.updateOne(
                { _id: p._id },
                { status: 'payment_expired', status_message: 'Payment was not received has expired before payment was received.' }
            );

        } else if (user === null) {

            await PaymentPurchase.updateOne(
                { _id: p._id },
                { status: 'user_failed', status_message: 'User could not be found.' }
            );

        } else if (user?.plan?.valid_until && moment.utc(user.plan.valid_until).isAfter(now)) {

            await PaymentPurchase.updateOne(
                { _id: p._id },
                { status: 'user_failed', status_message: `You already have a plan, valid until ${ moment.utc(user.plan.valid_until).toString() }.` }
            );

        } else if (p.whitelist_deal) {

            // Handle whitelisting deals

            let wl_deal = await PaymentWhitelistDeal
                .findOne( { chain: p.chain, wallet_address: new RegExp(user.eth_wallet_address, 'i'), product_sku: p.product.sku, redeemed_at: {$exists: false} } );
            if (wl_deal === null) {
                await PaymentPurchase.updateOne(
                    { _id: p._id },
                    { status: 'whitelist_failed', status_message: "The purchasing wallet is not whitelisted for this product." }
                );

            } else if (moment.utc(wl_deal.valid_until).isBefore(now)) {
                await PaymentPurchase.updateOne(
                    { _id: p._id },
                    { status: 'whitelist_failed', status_message: `This whitelist deal has expired on ${ moment.utc(wl_deal.valid_until).toString() }.` }
                );
            } else {

                const session = await mongoose.startSession();
                session.startTransaction();
                let valid_until = moment.utc().add(1, "hour").add(p.product.content.duration_days, "days");

                try {
                    await User.updateOne(
                        { _id: p.user_id },
                        { plan : { purchase_id: p._id, valid_until: valid_until.toDate() } }
                    );

                    await PaymentWhitelistDeal.updateOne(
                        { _id: wl_deal._id  },
                        { redeemed_at: now.toDate() }
                    );

                    await PaymentPurchase.updateOne(
                        { _id: p._id },
                        { status: 'success', started_at: now.toDate(), valid_until: valid_until.toDate() }
                    );
                    await session.commitTransaction();
                } catch (error) {
                    await session.abortTransaction();
                }

                session.endSession();
            }

        } else if (p?.transaction?.hash) {

            // Handle purchases on the Ethereum network

            let transaction: any;
            let receipt:any;
            try {
                transaction = await this.etherscan_api.proxy.eth_getTransactionByHash(p.transaction.hash);
                receipt = await this.etherscan_api.proxy.eth_getTransactionReceipt(p.transaction.hash);
            } catch(error) {
                console.log(error);
                return;
            }

            if (transaction.result !== null && receipt.result !== null) {

                await TransactionEthereum.updateOne(
                    {
                        hash: new RegExp(p.transaction.hash, 'i')
                    },
                    {
                        $setOnInsert: {
                            hash: transaction.result.hash.toLowerCase(),
                            status: parseInt(receipt.result.status, 16),
                            from: transaction.result.from.toLowerCase(),
                            to: transaction.result.to.toLowerCase(),
                            value: String(parseInt(transaction.result.value, 16))
                        }
                    },
                    { upsert: true }
                );

                if (parseInt(receipt.result.status, 16) == 0) {
                    await PaymentPurchase.updateOne(
                        { _id: p._id },
                        { status: 'payment_failed', status_message: `The transaction has failed.` }
                    );
                } else if (transaction.result.to.toLowerCase() != ETH_DESTINATION_WALLET_ADDRESS.toLowerCase()) {
                    await PaymentPurchase.updateOne(
                        { _id: p._id },
                        { status: 'payment_failed', status_message: `The destination wallet address is invalid.` }
                    );
                } else if (parseInt(transaction.result.value, 16) != parseInt(p.price.value, 10)) {
                    await PaymentPurchase.updateOne(
                        { _id: p._id },
                        { status: 'payment_failed', status_message: `The transaction value and the purchase value do not match.` }
                    );
                } else {

                    const session = await mongoose.startSession();
                    session.startTransaction();
                    let valid_until = moment.utc().add(1, "hour").add(p.product.content.duration_days, "days");

                    try {
                        await User.updateOne(
                            { _id: p.user_id },
                            { plan : { purchase_id: p._id, valid_until: valid_until.toDate() } }
                        );

                        await TransactionEthereum.updateOne(
                            { hash: new RegExp(p.transaction.hash, 'i') },
                            { purchase_id: p._id }
                        );

                        await PaymentPurchase.updateOne(
                            { _id: p._id },
                            { status: 'success', started_at: now.toDate(), valid_until: valid_until.toDate() }
                        );
                        await session.commitTransaction();
                    } catch (error) {
                        console.log(error);
                        await session.abortTransaction();
                    }

                    session.endSession();
                }
            }
        } else {
            await PaymentPurchase.updateOne(
                { _id: p._id },
                { status: 'payment_failed', status_message: `Neither a transaction hash or a whitelist deal could be found.` }
            );
        }
    }

    async createPurchase(params: IPurchaseRequest) : Promise<Ret> {

        if (params.product_sku === undefined || params.coupon === undefined || params.payment_total_price === undefined || params.payment_token === undefined || params.dry_run === undefined || params.user_data === undefined) {
            return { status: 'error', message: "Invalid parameters." };
        }

        let user = await User.findOne({ eth_wallet_address: new RegExp(params.user_data.eth_wallet_address, 'i') });
        let now = moment.utc();

        if (user === null) {
            return { status: 'error', message: `User not found.` };
        } else if (user?.plan?.valid_until && moment.utc(user.plan.valid_until).isAfter(now)) {
            return { status: 'error', message: `You already have a plan, valid until ${ moment.utc(user.plan.valid_until).toString() }.` };
        }

        let purchase_order_pending = await PaymentPurchase.findOne( { user_id: params.user_data.user_id, status: 'payment_pending' } );
        if (purchase_order_pending !== null) {
            return { status: 'error', message: "You have a purchase still getting processed. You cannot do another transaction until the previous one finishes." };
        }

        let product = await PaymentProduct.findOne( { sku: params.product_sku });
        console.log('product', product);
        if (product === null) {
            return { status: 'error', message: "The product does not exist." };
        } else if (product.availability == 'disabled') {
            return { status: 'error', message: "The product is unavailable." };
        }

        let wl_deal = await PaymentWhitelistDeal
            .findOne( { chain: "ethereum", wallet_address: new RegExp(user!.eth_wallet_address, 'i'), product_sku: params.product_sku, redeemed_at: {$exists: false} } );
        if (product.availability == 'whitelist') {
            if (wl_deal === null) {
                return { status: 'error', message: "The purchasing wallet is not whitelisted for this product." };
            } else if (now.isAfter(moment.utc(wl_deal.valid_until))) {
                return { status: 'error', message: `This whitelist deal has expired on ${ moment.utc(wl_deal.valid_until).toString() }.` };
            }
        }

        // TODO: Handle coupons by checking `params.coupon`

        if (product.price.payment_token !== params.payment_token) {
            return { status: 'error', message: "Invalid payment token." };
        }
        
        let payment_total_price = "0";
        if (product.discount === null) {
            payment_total_price = product.price.value;
        } else {
            payment_total_price = (parseInt(product.price.value, 10) * (1-product.discount.percentage/100)).toPrecision(6);
        }

        if (payment_total_price !== params.payment_total_price) {
            return { status: 'error', message: `Price is invalid: expected ${payment_total_price} but found ${params.payment_total_price}` };
        }

        if (params.dry_run === true) {
            return {
                status: 'success',
                message: 'Pre-transaction data appears to be valid.',
                data: {
                    payment_total_price: payment_total_price,
                    payment_token: product.price.payment_token,
                    wl_deal_id: wl_deal ? wl_deal._id : null,
                }
            };
        }

        let search_query:any;
        let transaction:any = undefined;
        if (params.transaction_hash) {
            search_query = {
                chain: "ethereum",
                user_id: params.user_data.user_id,
                "transaction.hash": new RegExp(params.transaction_hash, 'i')
            };
            transaction = {
                from: params.user_data.eth_wallet_address,
                hash: params.transaction_hash,
            };
        } else if (params.wl_deal_id) {
            search_query = {
                chain: "ethereum",
                user_id: params.user_data.user_id,
                "whitelist_deal._id": new mongoose.Types.ObjectId(params.wl_deal_id)
            }
        } else {
            return { status: 'error', message: "Invalid parameters."};
        }
          
        await PaymentPurchase.updateOne(
            search_query,
            {
                $setOnInsert: {
                    user_id: user._id,
                    created_at: moment.utc().toDate(),
                    status: 'payment_pending',
                    chain: "ethereum",
                    transaction: transaction,
                    price: {
                        value: payment_total_price,
                        payment_token: params.payment_token
                    },
                    product: product,
                    coupon_deal: null,
                    whitelist_deal: wl_deal
                }
            },
            { upsert: true }
        );

        let po = await PaymentPurchase.findOne(search_query);

        return { status: 'success', data: { purchase_id: po!._id } };
    }

}
