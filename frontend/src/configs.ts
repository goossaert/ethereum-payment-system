import { environment } from './environments/environment';

// In production, you should store configuration with something like dotenv: https://www.npmjs.com/package/dotenv

export const IS_PRODUCTION=environment.production;
export const SERVER=environment.apiUrl;

export const ETHEREUM_CHAIN_ID = '0x1'; // to debug use the Ropsten chain, id = '0x3', and for production use id = '0x1' Also change the chain on the backend.

export const JWT_RENEWAL_INTERVAL = 3600 * 1000;