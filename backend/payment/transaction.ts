import moment from 'moment';
import { Ret } from '../utils/ret';
import { TransactionEthereum } from './transaction.model';
import { ETHERSCAN_API_KEY, ETH_DESTINATION_WALLET_ADDRESS, ETHERSCAN_URL } from '../configs';

const { promisify } = require('util');
const sleepnow = promisify(setTimeout);

export class TransactionManager {
    constructor() {}

    async downloadTransactionsFromEthereumBlockchain() {
        let startBlock = 0;
        let endBlock = 999999999999;
        let ret:Ret;

        let lastTransaction = await TransactionEthereum.find({})
            .sort({ timestamp: -1 })
            .limit( 1 );

        if (lastTransaction.length != 0) {
            startBlock = lastTransaction[0].block_number;
        }

        while (true) {

            const https = require("https");
            const https_agent = new https.Agent({
                keepAlive: true
            });
        
            let p = new Promise<Ret>((resolve, reject) => {
                let query = `${ ETHERSCAN_URL }/api?module=account&action=txlist&address=${ ETH_DESTINATION_WALLET_ADDRESS }&startblock=${ startBlock }&endblock=${ endBlock }&sort=asc&apikey=${ ETHERSCAN_API_KEY }`;
                https.request(
                {
                    url: query,
                    method: 'GET',
                    agent: https_agent
                }, function(error: any, response: any, body: string) {
                try {
                    if (error !== null) {
                        resolve( { status: 'error', message: String(error) } );
                    } else if (response.statusCode != 200) {
                        resolve( { status: 'error', message: `HTTP ${ response.statusCode }: ${ response.statusMessage}` } );
                    }
        
                    let content = JSON.parse(body);
                    resolve( {status: 'success', data: content } );
        
                } catch(e) {
                    resolve( { status: 'error', message: String(e) } );
                }
        
                }); // end request()
            }); // end Promise()

            ret = await p;

            if (ret.status == 'error') {
                return ret;
            }

            if (ret.data.message == "No transactions found" || ret.data.result.length == 0) {
                return { status: 'success' };
            } else if (ret.data.status != "1") {
                return { status: 'error', message: "Could not validate the transaction on the Ethereum network." };
            }

            try {
                let bulk_inserts = [];
                for (let tx of ret.data.result) {
                    if (tx.to.toLowerCase() != ETH_DESTINATION_WALLET_ADDRESS.toLowerCase()) continue;
                    tx.blockNumber = parseInt(tx.blockNumber, 10);

                    if (tx.blockNumber > startBlock) {
                        startBlock = tx.blockNumber;
                    }
                    bulk_inserts.push({
                        updateOne:
                        {
                            filter: {
                                hash: tx.hash,
                            },
                            update: {
                                hash: tx.hash,
                                status: tx.txreceipt_status,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value,
                                timestamp: moment.unix(tx.timestamp).toDate(),
                                block_number: tx.blockNumber
                            },
                            upsert: true
                        }
                    });
                }

                let step = 10;
                for (let i = 0; i < bulk_inserts.length; i += step) {
                  await TransactionEthereum.bulkWrite(bulk_inserts.slice(i, i+step));
                }
            } catch(error) {
                return { status: 'error', message: String(error) };
            }

            await sleepnow(1 * 1000);
        }

    }

}
