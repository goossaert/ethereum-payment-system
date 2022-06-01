import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { SERVER } from '../../configs';
import { catchError, timeout } from "rxjs/operators";
import { of} from 'rxjs';

@Injectable({providedIn: 'root'})
export class UserService {

  constructor(private http: HttpClient) {}

  async filteredHttpQuery(url: string, timeout_ms?:number): Promise<any> {

      var data = await this.http.get<any>(url).pipe(
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

  async getPlan(): Promise<any> {
    let url = `${SERVER}/api/user/plan`;
    return await this.filteredHttpQuery(url);
  }

  async getPlanBasic(): Promise<any> {
    let url = `${SERVER}/api/user/plan_basic`;
    return await this.filteredHttpQuery(url);
  }
  
}