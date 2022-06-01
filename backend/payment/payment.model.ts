import mongoose from 'mongoose';

export interface IPaymentProduct extends mongoose.Document {
    sku: string,
    availability: string, // public, whitelist, disabled
    created_at: Date,
    metadata: {
        name: string,
        description: string
    },
    content: {
        duration_days: number,
    },
    price: {
        value: string,
        payment_token: string,
    },
    discount: null | {
        percentage: number,
        description: string
    }
}

const PaymentProductSchema = new mongoose.Schema({
    sku: { type: String, index: true },
    availability: { type: String },
    created_at: { type: Date },
    metadata: {
        name: { type: String },
        description: { type: String }
    },
    content: {
        duration_days: { type: Number },
    },
    price: {
        value:  { type: String },
        payment_token: { type: String },
    },
    discount: { type: mongoose.Schema.Types.Mixed },
});
  
export const PaymentProduct = mongoose.model<IPaymentProduct>('PaymentProduct', PaymentProductSchema);





export interface IPaymentPurchase extends mongoose.Document {
    user_id: mongoose.Types.ObjectId,
    created_at: Date,
    started_at: null | Date,
    valid_until: null | Date,
    cancelled_at: null | Date,
    status: string,
    status_message: string,
    chain: string,
    transaction: {
        from: string,
        hash: null | string
    },
    price: {
        value: string,
        payment_token: string,
    },
    product: any,
    coupon_deal: any,
    whitelist_deal: any,
}
  
const PaymentPurchaseSchema = new mongoose.Schema({
    user_id: { type: mongoose.Types.ObjectId, index: true },
    created_at: { type: Date, index: true },
    started_at: { type: Date, index: true },
    valid_until: { type: Date, index: true },
    cancelled_at: { type: Date, index: true },
    status: { type: String },
    status_message: { type: String },
    chain: { type: String, index: true },
    transaction: {
        from: { type: String, index: true },
        hash: { type: String, index: true },
    },
    price: {
        value:  { type: String },
        payment_token: { type: String },
    },
    product: { type: mongoose.Schema.Types.Mixed },
    coupon_deal: { type: mongoose.Schema.Types.Mixed },
    whitelist_deal: { type: mongoose.Schema.Types.Mixed },
});
  
export const PaymentPurchase = mongoose.model<IPaymentPurchase>('PaymentPurchase', PaymentPurchaseSchema);






export interface IPaymentWhitelistDeal extends mongoose.Document {
    chain: string,
    wallet_address: string,
    created_at: Date,
    valid_until: Date,
    redeemed_at: null | Date,
    product_sku: string,
    description: string,
}
  
const PaymentWhitelistDealSchema = new mongoose.Schema({
    chain: { type: String, index: true },
    wallet_address: { type: String, index: true },
    created_at: { type: Date },
    valid_until: { type: Date },
    redeemed_at: { type: Date },
    product_sku: { type: String },
    description: { type: String },
});
  
export const PaymentWhitelistDeal = mongoose.model<IPaymentWhitelistDeal>('PaymentWhitelistDeal', PaymentWhitelistDealSchema);






export interface IPaymentCouponDeal extends mongoose.Document {
    name: string,
    description: string,
    created_at: Date,
    valid_until: Date,
    product_sku: string,
    discount_percentage: number,
}
  
const PaymentCouponDealSchema = new mongoose.Schema({
    name: { type: String, index: true },
    description: { type: String },
    created_at: { type: Date },
    valid_until: { type: Date },
    product_sku: { type: String },
    discount_percentage: { type: Number },
});
  
export const PaymentCouponDeal = mongoose.model<IPaymentCouponDeal>('PaymentCouponDeal', PaymentCouponDealSchema);