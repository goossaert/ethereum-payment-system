import jwt from "jsonwebtoken";
import moment from "moment";
import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET_SALT } from '../configs';

export const AuthHandler = (
  request: any,
  reponse: Response,
  next: NextFunction
) => {
  try {
    const token = request.headers.authorization.split(" ")[1];
    const decodedData: any = jwt.verify(token, JWT_SECRET_SALT);

    request.userData = { eth_wallet_address: decodedData.eth_wallet_address.toLowerCase(),
                         user_id: decodedData.user_id,
                         plan_valid_until: decodedData.plan_valid_until,
                       };

    next();
  } catch(e) {
    reponse.status(401).json({status: "error", message: "Auth failed."});
  }
};