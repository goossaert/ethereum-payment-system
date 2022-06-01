import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { SERVER } from '../../configs';
import { catchError, timeout } from "rxjs/operators";
import { of} from 'rxjs';

export interface IPurchaseOrder {
    product_sku: string,
    coupon: string,
    payment_total_price: string,
    payment_token: string,
    dry_run?: boolean,
    transaction_hash?: string,
    wl_deal_id?: string,
};

@Injectable({providedIn: 'root'})
export class PaymentService {

  constructor(private http: HttpClient) {}

  async filteredHttpPostQuery(url: string, params:any): Promise<any> {

      var data = await this.http.post<any>(url, params).pipe(
        timeout(20000),
        catchError((err) => {
            if (err?.error?.message) {
                return of( {'status': 'error', message: err?.error?.message} );
            } else if (err?.message) {
                return of( {'status': 'error', message: err.message} );
            } else {
                return of( {'status': 'error', message: err} );
            }
        })).toPromise();

      return Promise.resolve(data);
  }

  async createPurchaseOrder(purchase_order:IPurchaseOrder): Promise<any> {
    purchase_order.dry_run = false;
    let url = `${SERVER}/api/payment/purchase`;
    return await this.filteredHttpPostQuery(url, purchase_order);
  }

  async verifyPurchaseOrder(purchase_order:IPurchaseOrder): Promise<any> {
    purchase_order.dry_run = true;
    let url = `${SERVER}/api/payment/purchase`;
    return await this.filteredHttpPostQuery(url, purchase_order);
  }

  async checkPurchaseOrdersForUpdate(po_ids: string[]): Promise<any> {
    let url = `${SERVER}/api/payment/purchase_orders`;
    return await this.filteredHttpPostQuery(url, {po_ids: JSON.stringify(po_ids)});
  }

  async getEthWalletAddress(): Promise<any> {
    let url = `${SERVER}/api/payment/ethwalletaddress`;
    return await this.filteredHttpPostQuery(url, {});
  }
  
}