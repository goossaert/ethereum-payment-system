export const PORT = process.env.PORT || 3000;

// In production, you should store configuration with something like dotenv: https://www.npmjs.com/package/dotenv

export const DBCONFIG = 'mongodb://user:pw@IP:PORT/db?options';
export const MONGODB_TIMEOUT = 30000; // in milliseconds

export const ETHERSCAN_TIMEOUT = 10000; // in milliseconds
export const ETHERSCAN_API_KEY = 'INSERT_YOUR_KEY_HERE';
export const ETHERSCAN_CHAIN_NAME = 'main'; // to debug on the Ropsten chain, change 'main' to 'ropsten' -- also change the chainId in the frontend, from 0x1 to 0x3.
export const ETHERSCAN_URL = 'https://api.etherscan.io'; //  to debug on the Ropsten chain, change this URL to https://api-ropsten.etherscan.io

export const JWT_SECRET_SALT = 'vQFZPFa9RW28ULqwaM9ddg7cB'; // TODO change for another salt before you deploy to production
export const DELAY_TOKEN_EXPIRE_HOURS = 168;
export const DELAY_TOKEN_EXPIRE_SECONDS = DELAY_TOKEN_EXPIRE_HOURS * 3600;
export const DELAY_TOKEN_EXPIRE_STRING = `${DELAY_TOKEN_EXPIRE_HOURS}h`;
export const DELAY_TOKEN_RENEW = 3600; // in seconds

export const ETH_DESTINATION_WALLET_ADDRESS = '0x1234'; // TODO: this is IMPORTANT, it's the eth wallet that receives the payments