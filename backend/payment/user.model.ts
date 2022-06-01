import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
    created_at: Date,
    eth_wallet_address: string,
    auth: {
        nonce: string,
        last_auth_at: Date,
        last_auth_status: string
    },
    plan: null | {
        purchase_id: mongoose.Types.ObjectId,
        valid_until: Date
    }
    settings: any
}
  
const UserSchema = new mongoose.Schema({
    created_at: { type: Date, index: true },
    eth_wallet_address: { type: String, index: true, unique: true },
    auth: {
        nonce: { type: String },
        last_auth_at: { type: Date },
        last_auth_status: { type: String },
    },
    plan: { type: mongoose.Schema.Types.Mixed },
    settings: { type: mongoose.Schema.Types.Mixed },
});
  
export const User = mongoose.model<IUser>('User', UserSchema);

export interface SafeUserData {
    user_id: string,
    eth_wallet_address: string,
    plan_valid_until?: Date
};