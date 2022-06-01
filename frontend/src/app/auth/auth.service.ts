import moment from "moment";
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import detectEthereumProvider from "@metamask/detect-provider";
import { HttpClient } from "@angular/common/http";
import { SERVER, JWT_RENEWAL_INTERVAL } from "../../configs";
import { Ret } from "../../ret";

import { catchError, timeout } from "rxjs/operators";
import { of } from 'rxjs';

@Injectable({providedIn: 'root'})
export class AuthService {
    private authStatusListener = new Subject<boolean>();
    private tokenRenewInterval: any = null;

    constructor(private http: HttpClient) {

        (async () => {
            if (localStorage.getItem("ethAddress")) {
                this.loadEthAddressAsMain(
                    localStorage.getItem("ethAddress"),
                    localStorage.getItem("token"),
                    moment.utc(localStorage.getItem("planValidUntil")).toDate()
                 );
                await this.renewToken();
            }

        })();
    }

    loadEthAddressAsMain(address: string, token: string, planValidUntil: Date) {
        address = address.toLowerCase();
        localStorage.setItem("ethAddress", address);
        localStorage.setItem("token", token);
        localStorage.setItem("planValidUntil", moment.utc(planValidUntil).toISOString());
        this.authStatusListener.next(true);
        this.activateRenewInterval();
    }


    public isAuthenticated() {
        if (this.getToken()) {
            return true;
        } else {
            return false;
        }
    }

    public hasValidPlan() {
        let planValidUntil = localStorage.getItem("planValidUntil");
        if (planValidUntil && moment.utc(planValidUntil).isAfter(moment.utc())) {
            return true;
        } else {
            return false;
        }
    }

    public getAuthStatusListener() {
        return this.authStatusListener.asObservable();
    }

    public getEthAddress() {
        return localStorage.getItem("ethAddress");
    }

    public getToken() {
        return localStorage.getItem("token");
    }

    public signOut() {
        if (!this.isAuthenticated) return;
        localStorage.removeItem("ethAddress");
        localStorage.removeItem("token");
        localStorage.removeItem("planValidUntil");

        if (this.tokenRenewInterval) {
            clearInterval(this.tokenRenewInterval);
        }

        // Cleaning up local data and propagating change
        this.authStatusListener.next(false);
    }

    public async signInWithMetaMask(address?:string) : Promise<Ret> {

        let ethereum:any = await detectEthereumProvider();
        if (!ethereum) return { status: 'error', message: 'Error: MetaMask was not found.\r\n\r\nYou must have a MetaMask wallet to use our website. Install the MetaMask browser extension and try again.', data: 'metamask-missing' };
        let req;
        try {
            req = await ethereum.request({ method: 'eth_requestAccounts' });
        } catch(e) {
            if (String(e.message) == 'Already processing eth_requestAccounts. Please wait.') {
                return { status: 'error', message: "Something went wrong with your MetaMask wallet: open the MetaMask browser extension to fix it." };
            }
            return { status: 'error', message: String(e.message) };
        }

        let selectedAddress = ethereum.selectedAddress.toLowerCase();
        if (address) {
            selectedAddress = address.toLowerCase();
        }

        let nonce_response:any = await this.http.post(`${SERVER}/api/user/wallet_nonce`, { address: selectedAddress }).toPromise()
        if (nonce_response.status != 'success') {
            return nonce_response;
        }

        let signature;
        try {
            signature = await ethereum.request({
                method: 'personal_sign',
                params: [
                    `0x${this.toHex(nonce_response.data.nonce)}`,
                    selectedAddress,
                ],
            });
        } catch(e) {
            return { status: 'error', message: String(e.message) };
        }

        if (!signature) return { status: 'error', message: 'Error: The signature provided by the wallet was invalid. If the problem persists, contact customer support.', data: 'invalid-signature' };
        let verify_response:any = await this.http.post(`${SERVER}/api/user/wallet_verify`, { address: selectedAddress, signature: signature, }).toPromise();
        if (verify_response.status != 'success') {
            return verify_response;
        }

        // Marking the current wallet as authenticated
        this.loadEthAddressAsMain(verify_response.data.eth_wallet_address, verify_response.data.token, verify_response.data.plan_valid_until);

        return { status: 'success' }
    }

    async renewToken() {
        if (!this.isAuthenticated) {
            throw Error('Cannot renew if the user is not authenticated');
        }

        try {

            var ret = await this.http.get<Ret>(SERVER + "/api/user/renewjwt").pipe(
                timeout(30000), // in ms
                catchError((err) => {
                    if (err.name == "HttpErrorResponse" && err.statusText == "Unknown Error") {
                        return of(<Ret>{status: "noop"});
                    } else if (err.name == "HttpErrorResponse" && (err.status == 401 || err.statusText == "Unauthorized")) {
                        return of(<Ret>{status: "unauthorized", message: `HTTP ${err.status}: ${err.message}`});
                    }
                    return of(<Ret>{status: "error", message: `HTTP ${err.status}: ${err.message}`});
                })
            ).toPromise();

            if (ret.status == 'noop') {
                // do nothing;
            } else if (ret.status == 'success') {
                localStorage.setItem("ethAddress", ret.data.eth_wallet_address);
                localStorage.setItem("token", ret.data.token);
                localStorage.setItem("planValidUntil", moment.utc(ret.data.plan_valid_until).toISOString());
            } else if (ret.status == 'unauthorized') {
                this.signOut();
            } else if (ret.status == 'error') {
                throw Error(ret.message);
            }

        } catch(e) {
          // Could not renew the token 
          // TODO: here you can decide to sign out the user, or keep the user signed in and kick him out from the backend.
        }
    }

    private activateRenewInterval() {
        if (this.tokenRenewInterval) {
            clearInterval(this.tokenRenewInterval);
        }

        this.tokenRenewInterval = setInterval(() => {
            (async () => {
                await this.renewToken();
            })();
        }, JWT_RENEWAL_INTERVAL);
    }


    private toHex(stringToConvert: string) {
        return stringToConvert
        .split('')
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
    }
}

  