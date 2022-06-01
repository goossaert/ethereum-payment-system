import mongoose from 'mongoose';

export interface IErrorLog extends mongoose.Document {
    created_at: Date,
    path: string,
    input: any,
    http_headers: any,
    user_id: null|string,
    title: string,
    stacktrace: string,
}

const ErrorLogSchema = new mongoose.Schema({
    created_at: { type: Date, index: true },
    path: { type: String, index: true },
    input: { type: mongoose.Schema.Types.Mixed },
    http_headers: { type: mongoose.Schema.Types.Mixed },
    user_id: { type: String, index: true },
    title: { type: String },
    stacktrace: { type: String },
});

export const ErrorLog = mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);

export function logError(e: IErrorLog) {
    (async () => {
        try {
            await ErrorLog.insertMany([e]);
        } catch (error) {
            console.log('Failed to store error to database');
            console.log(JSON.stringify(error, null, 4));
            console.log('Error lost:', e)
        }
    })();
}