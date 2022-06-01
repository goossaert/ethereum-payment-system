import mongoose from 'mongoose';

export interface ITransactionEthereum extends mongoose.Document {
    hash: string,
    status: string,
    from: string,
    to: string,
    value: string,
    timestamp: Date,
    block_number: number,
    purchase_id: null | mongoose.Types.ObjectId,
}
  
const TransactionEthereumSchema = new mongoose.Schema({
    hash: { type: String, index: true },
    status: { type: String, index: true },
    from: { type: String, index: true },
    to: { type: String, index: true },
    value: { type: String },
    timestamp: { type: Date, index: true },
    block_number: { type: Number, index: true },
    purchase_id: { type: mongoose.Types.ObjectId, index: true },
});
  
export const TransactionEthereum = mongoose.model<ITransactionEthereum>('TransactionEthereum', TransactionEthereumSchema);