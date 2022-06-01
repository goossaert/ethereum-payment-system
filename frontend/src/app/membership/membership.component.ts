import moment from 'moment';
import { Component, OnInit, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import detectEthereumProvider from "@metamask/detect-provider";

import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';
import { Subscription } from 'rxjs';
import { PaymentService, IPurchaseOrder } from './payment.service';
import { Ret } from '../../ret';
import { IS_PRODUCTION, ETHEREUM_CHAIN_ID } from '../../configs';



@Component({
  selector: 'app-membership',
  templateUrl: './membership.component.html',
  styleUrls: ['./membership.component.css']
})
export class MembershipComponent implements OnInit {
  constructor(
    public authService: AuthService,
    private userService: UserService,
    private router: Router,
    private paymentService: PaymentService
   ) {}

   private authListenerSubs: Subscription;
   plans: string;
   products: any = [];
   purchases: any = [];
   sku_to_products: any = {};
   alreadyHasPlan: boolean = false;
   planValidUntil: Date;
   selectedProductSku = null;
   chainId = ETHEREUM_CHAIN_ID;

   payment_status_icon = null;
   payment_status_message = null;

  ngOnInit() {

      this.authListenerSubs = this.authService
        .getAuthStatusListener()
        .subscribe(ping => {
          this.initializePage();
        }
      );

      this.initializePage();
  }

  ngOnDestroy() {
    this.authListenerSubs.unsubscribe();
  }

  isProduction() {
    return IS_PRODUCTION;
  }

  isAuthenticated() {
    return this.authService.isAuthenticated();
  }

  dateToLocalTimeString(d: Date) {
    return moment(d).utc().local().format('D MMMM YYYY [at] h:mma');
  }

  initializePage() {
      (async () => {
          let ret;
          if (this.authService.isAuthenticated()) {
            ret  = await this.userService.getPlan();
            let now = moment.utc();
            if (ret?.data?.user?.plan?.valid_until && moment.utc(ret.data.user.plan.valid_until).isAfter(now)) {
              this.alreadyHasPlan = true;
              this.planValidUntil = ret.data.user.plan.valid_until;
            }
          } else {
            ret = await this.userService.getPlanBasic();
            this.alreadyHasPlan = false;
          }
          this.products = ret.data.products;
          this.purchases = ret.data.purchases;
          this.plans = JSON.stringify(ret, null, 4);
          //this.selectedProduct = null;
          this.sku_to_products = {};
          for (let p of ret.data.products) {
            this.sku_to_products[p.sku] = p;
          }

          let purchase_ids = this.purchases.map(x => x._id);
          this.loopCheckPastPurchaseOrdersForUpdate(purchase_ids);
      })();
  }

  payNow() {
    if (!this.selectedProductSku) {
      this.updatePaymentStatus('highlight_off', 'Please select the product you want to buy.');
      return;
    }

    (async () => {
      
      let purchase_order: IPurchaseOrder = {
        product_sku: this.selectedProductSku,
        coupon: null,
        payment_total_price: this.sku_to_products[this.selectedProductSku].price.value,
        payment_token: this.sku_to_products[this.selectedProductSku].price.payment_token,
        dry_run: true,
      }
  
      let ret_verify = await this.paymentService.verifyPurchaseOrder(purchase_order);

      if (ret_verify.status != 'success') {
        this.updatePaymentStatus('highlight_off', ret_verify.message);
        return;
      }

      let ret_ethwalletaddress = await this.paymentService.getEthWalletAddress();
      if (ret_ethwalletaddress.status != 'success') {
        this.updatePaymentStatus('highlight_off', ret_ethwalletaddress.message);
        return;
      }

      let ethwalletaddress = ret_ethwalletaddress.data.ethwalletaddress.toLowerCase();

      let ret_purchase = null;
      if (ret_verify.data.wl_deal_id) {
        // Whitelist deal
        purchase_order.wl_deal_id = ret_verify.data.wl_deal_id;
        ret_purchase = await this.paymentService.createPurchaseOrder(purchase_order);

      } else {
        // Payment needed
        try {
            let ethereum:any = await detectEthereumProvider();
            if (!ethereum) {
                this.updatePaymentStatus('highlight_off', 'Error: MetaMask was not found.\r\n\r\nYou must have a MetaMask wallet to use our website. Install the MetaMask browser extension and try again.');
                return;
            } else if (ethereum.selectedAddress.toLowerCase() != this.authService.getEthAddress()) {
              let ret = await ethereum.request({
                method: "wallet_requestPermissions",
                params: [ { eth_accounts: {} } ]
              });
              let selectedWallets = ret[0]?.caveats[0]?.value; // this is an array
              if (!selectedWallets) {
                  this.updatePaymentStatus('highlight_off', 'Error: You must selected one wallet.');
                  return;
              } else if (selectedWallets.length != 1) {
                  this.updatePaymentStatus('highlight_off', 'Error: You must selected only one wallet.');
                  return;
              }

              if (selectedWallets[0].toLowerCase() != this.authService.getEthAddress()) {
                this.updatePaymentStatus('highlight_off', 'Error: You selected a different wallet from the one you signed in with: you must select your signed-in wallet. If you want to use a different wallet, then you must sign out and sign in again.');
                return;
              }
            }

            const chainId = await ethereum.request({ method: 'eth_chainId' });
            if (chainId != this.chainId) {
              this.updatePaymentStatus('highlight_off', 'Error: You are not using the main network. Open your MetaMask wallet and select the "Ethereum Mainnet".');
              return;
            }
 
            let txHash = await ethereum.request({
                method: 'eth_sendTransaction',
                params: [
                    {
                      nonce: 0x00,
                      from: this.authService.getEthAddress(),
                      to: ethwalletaddress,
                      value: '0x' + parseInt(purchase_order.payment_total_price, 10).toString(16),
                      chainId: this.chainId,
                    },
                ],
            });
           
            purchase_order.transaction_hash = txHash;
            ret_purchase = await this.paymentService.createPurchaseOrder(purchase_order);

        } catch(error) {
            ret_purchase = { status: 'error', message: String(error.message) };
        }
      }

      if (!ret_purchase || ret_purchase.status != 'success') {
        this.updatePaymentStatus('highlight_off', ret_purchase?.message);
        return;
      }

      this.loopCheckLastPurchaseOrderForUpdate([ret_purchase.data.purchase_id]);


    })();
  }

  
  loopCheckLastPurchaseOrderForUpdate(purchase_ids: string[]) {
      var that = this;
      (async () => {
          this.updatePaymentStatus("autorenew", "Checking the Ethereum network for updates...");
          let ret: Ret = await this.paymentService.checkPurchaseOrdersForUpdate(purchase_ids);
          if (ret.status == 'success' && ret.data.hasPendingPurchases === false) {
            if (!(ret?.data?.purchases) || ret?.data?.purchases?.length === 0) {
              this.updatePaymentStatus("highlight_off", "Error: something unexpected happened. If the transaction happened, contact customer service.");
            } else if (ret.data.purchases[0].status != 'success') {
              this.updatePaymentStatus("highlight_off", ret.data.purchases[0].status_message);
            } else {
              this.updatePaymentStatus("check_circle_outline", "Purchase successful!");
              await this.authService.renewToken();
            }
          } else if (ret.status == 'success' && ret.data.hasPendingPurchases === true) {
            this.updatePaymentStatus("update", "Waiting for transaction to be processed...");
              setTimeout(function() {
                  that.loopCheckLastPurchaseOrderForUpdate(purchase_ids);
              }, 10000);
          } else {
            this.updatePaymentStatus("highlight_off", ret.message);
          }
      })();
  }



  loopCheckPastPurchaseOrdersForUpdate(purchase_ids: string[]) {
    var that = this;
    (async () => {
        let ret: Ret = await this.paymentService.checkPurchaseOrdersForUpdate(purchase_ids);
        if (ret.status == 'success') {
          that.purchases = ret.data.purchases;
          if (ret.data.hasPendingPurchases === false) {
            await this.authService.renewToken();
          } else {
            setTimeout(function() {
                that.loopCheckPastPurchaseOrdersForUpdate(purchase_ids);
            }, 5000);
          }
        } else {
          // do nothing
        }
    })();
  }


  updatePaymentStatus(icon:string, message:string) {
    this.payment_status_icon = icon;
    this.payment_status_message = message;
  }

  connectWalletAndPayNow() {
    (async () => {
      this.updatePaymentStatus('', '');
      if (!this.selectedProductSku) {
        this.updatePaymentStatus('highlight_off', 'Please select the product you want to buy.');
        return;
      }
      let ret_signin = await this.authService.signInWithMetaMask();
      if (ret_signin.status != 'success') {
        this.updatePaymentStatus('highlight_off', ret_signin.message);
        return;
      }
      this.payNow();
    })();
  }


  saveSelectedProductSku(e) {
    this.selectedProductSku = e;
  }


  private toHex(stringToConvert: string) {
    return stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  }
}
