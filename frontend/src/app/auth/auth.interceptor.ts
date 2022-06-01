import moment from 'moment';
import { HttpInterceptor, HttpRequest, HttpHandler } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AuthService } from "./auth.service";

// TODO This code is injecting the token in all HTTP connections, including those to third-party services.
//      This should be changed to filter out third-parties, read this: https://stackoverflow.com/a/63777185
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {}
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const authToken = localStorage.getItem("token");
    const authRequest = req.clone({
      headers: req.headers.set('Authorization', 'Bearer ' + authToken)
    });
    return next.handle(authRequest);
  }
}
