import express from 'express';
import moment from 'moment';
import { SafeUserData, User } from '../payment/user.model';
import { AuthHandler } from '../middleware/auth.middleware';
import { Ret } from '../utils/ret';
import { PaymentManager } from '../payment/payment';
import { logError, IErrorLog } from '../payment/errorlog';
import { ETH_DESTINATION_WALLET_ADDRESS } from '../configs';

const { promisify } = require('util')
const sleepnow = promisify(setTimeout)

export const paymentRouter = express.Router();

paymentRouter.post('/purchase', AuthHandler, async (request:any, response, next) => {
    let params: any = {
        user_data: <SafeUserData>request.userData,
        product_sku: request.body.product_sku,
        coupon: request.body.coupon,
        payment_total_price: request.body.payment_total_price,
        payment_token: request.body.payment_token,
        dry_run: request.body.dry_run,
        transaction_hash: request.body.transaction_hash,
        wl_deal_id: request.body.wl_deal_id
    }

    try {

        let txManager = new PaymentManager();
        let ret:Ret = await txManager.createPurchase(params);

        if (ret.status == 'success') {
            return response.status(200).json(ret);
        } else {
            return response.status(400).json(ret);
        }

    } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'payment.purchase',
            input: params,
            http_headers: request.headers,
            user_id: params.user_data.user_id,
            title: err.toString(),
            stacktrace: err.stack,
        };
        logError(e);
        return response.sendStatus(500);
    }
});



paymentRouter.post('/purchase_orders', AuthHandler, async (request:any, response, next) => {
    let po_ids: any;
    try {
        if (!(request?.body?.po_ids)) {
            return response.status(400).json({status:'error', message: 'Parameters are missing.'});
        }
        po_ids = JSON.parse(request.body.po_ids);

        if (po_ids.length == 0) {
            return response.status(400).json({status:'error', message: 'Parameters are missing.'});
        }

        let txManager = new PaymentManager();
        let ret:Ret = await txManager.handleAndReturnPurchaseOrders(po_ids);

        return response.status(200).json(ret);

    } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'payment.purchase_orders',
            input: { po_ids: po_ids },
            http_headers: request.headers,
            user_id: request.userData.user_id,
            title: err.toString(),
            stacktrace: err.stack,
        };
        logError(e);
        return response.sendStatus(500);
    }
});


paymentRouter.post('/ethwalletaddress', AuthHandler, async (request:any, response, next) => {

    try {
        return response
            .status(200)
            .json({status:'success', data:{ethwalletaddress: ETH_DESTINATION_WALLET_ADDRESS.toLowerCase()}});
    } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'payment.ethwalletaddress',
            input: {},
            http_headers: request.headers,
            user_id: request.userData.user_id,
            title: err.toString(),
            stacktrace: err.stack,
        };
        logError(e);
        return response.sendStatus(500);
    }
});
