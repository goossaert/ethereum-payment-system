import express from 'express';
import moment from 'moment';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { AuthHandler } from '../middleware/auth.middleware';
import { SafeUserData, User, IUser } from '../payment/user.model';
import { PaymentPurchase, PaymentProduct, PaymentWhitelistDeal } from '../payment/payment.model';
import { DELAY_TOKEN_EXPIRE_STRING, JWT_SECRET_SALT } from '../configs';
import { IErrorLog, logError } from '../payment/errorlog';

export const userRouter = express.Router();


async function generateToken(user_id: string, user?:((IUser & {_id: any;}) | null)) : Promise<any> {
    try {
        if (!user) {
            user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) });
        }
        if (!user) {
            return {status: 'error', message: "User not found."};
        }

        let plan_valid_until = undefined;
        if (user.plan?.valid_until) {
            if (moment.utc(user.plan.valid_until).isAfter(moment.utc())) {
                plan_valid_until = user.plan.valid_until;
            } else {
                await User.updateOne(
                    { _id: user._id },
                    { $unset: { plan: 1 } }
                );
            }
        }

        let token = jwt.sign(
            <SafeUserData>{
                user_id: user._id,
                eth_wallet_address: user.eth_wallet_address.toLowerCase(),
                plan_valid_until: plan_valid_until
            },
            JWT_SECRET_SALT,
            { expiresIn: DELAY_TOKEN_EXPIRE_STRING }
        );
        return {status: 'success', data: { token: token, plan_valid_until: plan_valid_until } };
    } catch (error) {
        return {status: 'error', message: 'Token generation failed.'};
    }
    
}

function toHex(stringToConvert: string) {
    return stringToConvert
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
}

userRouter.post('/wallet_nonce', async (request, response, next) => {
    try {
        if (request.method !== 'POST') {
          return response.sendStatus(403);
        }

        if (!request.body.address) {
          return response.sendStatus(400);
        }

        request.body.address = request.body.address.toLowerCase();

        let user = await User.findOne({ eth_wallet_address: new RegExp(request.body.address, 'i') });
        if (user === null) {
            await User.updateOne(
                {
                    eth_wallet_address: request.body.address
                },
                {
                    $setOnInsert: {
                        eth_wallet_address: request.body.address,
                        created_at: moment.utc().toDate(),
                    }
                },
                { 
                    upsert: true
                }
            );
            user = await User.findOne({ eth_wallet_address: new RegExp(request.body.address, 'i') });
        }

        const generated_nonce = Math.floor(Math.random() * 1000000).toString();

        await User.updateOne(
            { eth_wallet_address: request.body.address },
            { auth: {
                nonce: generated_nonce,
                last_auth_at: moment.utc().toDate(),
                last_auth_status: "pending"
            } }
        );

        return response.status(200).json( { status: 'success', data: { nonce: generated_nonce } } );
      } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'user.wallet_nonce',
            input: {},
            http_headers: request.headers,
            title: err.toString(),
            stacktrace: err.stack,
        };
        logError(e);
        return response.sendStatus(500);
      }
});


userRouter.post('/wallet_verify', async (request, response, next) => {
    try {
        if (request.method !== 'POST') {
            return response.sendStatus(403);
        }
        if (!request.body.address || !request.body.signature) {
            return response.sendStatus(400);
        }

        request.body.address = request.body.address.toLowerCase();

        let user = await User.findOne({ eth_wallet_address: new RegExp(request.body.address, 'i') });
        if (user?.auth?.nonce === null || user?.auth?.nonce === undefined) {
           return response.sendStatus(500);
        }

        const recovered_address = recoverPersonalSignature({
            data: `0x${toHex( user.auth.nonce )}`,
            signature: request.body.signature,
        }).toLowerCase();

        // Updating the nonce to prevent replay attack
        const generated_nonce = Math.floor(Math.random() * 1000000).toString();

        if (recovered_address !== request.body.address) {
            await User.updateOne(
                { eth_wallet_address: request.body.address },
                { auth: {
                    nonce: generated_nonce,
                    last_auth_at: moment.utc().toDate(),
                    last_auth_status: "failed"
                } }
            );
            return response.sendStatus(401);
        }

        await User.updateOne(
            { eth_wallet_address: request.body.address },
            { auth: {
                nonce: generated_nonce,
                last_auth_at: moment.utc().toDate(),
                last_auth_status: "success"
            } }
        );

        const ret_token = await generateToken(user._id, user);
        if (ret_token.status == 'error') {
            return ret_token;
        }

        return response.status(200).json({
            status: "success",
            data: {
                token: ret_token.data.token,
                eth_wallet_address: request.body.address,
                plan_valid_until: ret_token.data.plan_valid_until,
            }
        });

      } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'user.wallet_verify',
            input: {},
            http_headers: request.headers,
            title: err.toString(),
            stacktrace: err.stack,
        };
        logError(e);
        return response.sendStatus(500);
      }
});



userRouter.get('/renewjwt', AuthHandler, async (request:any, response, next) => {
    try {
        let userData = <SafeUserData>request.userData;
        const ret_token = await generateToken(userData.user_id);
        if (ret_token.status == 'error') {
            return response.status(200).json(ret_token);
        }

        return response.status(200).json({
            status: "success",
            data: {
                token: ret_token.data.token,
                eth_wallet_address: userData.eth_wallet_address,
                plan_valid_until: ret_token.data.plan_valid_until,
            }
        });
    } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'user.renewjwt',
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



userRouter.get('/plan', AuthHandler, async (request:any, response, next) => {
    try {
        let userData = <SafeUserData>request.userData;
        let user = await User.findOne({ eth_wallet_address: new RegExp(userData.eth_wallet_address, 'i') });

        let purchases = await PaymentPurchase
            .find( { user_id: user!._id })
            .sort( { created_at: 1 });

        let wl_deals = await PaymentWhitelistDeal
            .find( { chain: "ethereum", wallet_address: new RegExp(user!.eth_wallet_address, 'i'), redeemed_at: { $exists: false } } );

        let or_conditions:any = [
            { availability: { $eq: 'public' } },
        ];

        if (wl_deals && wl_deals.length > 0) {
            or_conditions.push(
                { $and: [
                    { availability: { $eq: 'whitelist' } },
                    { sku: { $in: wl_deals.map(deal => deal.product_sku) } },
                ]}
            );
        }

        let products = await PaymentProduct
            .find( {
                $or: or_conditions
            })
            .sort( { "price.value": 1 } );

        return response
            .status(200)
            .json( {
                status: 'success',
                data: {
                    user: user,
                    products: products,
                    purchases: purchases,
                }
            });
    } catch (err) {
        let e: any = {
            created_at: moment.utc().toDate(),
            path: 'user.renewjwt',
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



userRouter.get('/plan_basic', async (request:any, response, next) => {
    try {
        let products = await PaymentProduct
            .find( { availability: { $eq: 'public' } } )
            .sort( { "price.value": -1 } );
        return response
            .status(200)
            .json( { status: 'success', data: { products: products } });
    } catch (err) {
        console.log(err);
        return response.sendStatus(500);
    }
});
