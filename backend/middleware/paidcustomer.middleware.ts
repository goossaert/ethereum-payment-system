import moment from "moment";
import { Request, Response, NextFunction } from 'express';

export const PaidCustomerHandler = (
  request: any,
  reponse: Response,
  next: NextFunction
) => {
  try {
    if (!request?.userData?.plan_valid_until) {
      console.log("No plan was found.");
      throw new Error("No plan was found.");
    } else if (moment.utc(request.userData.plan_valid_until).isBefore(moment.utc())) {
      console.log("Plan has expired.");
      throw new Error("Plan has expired.");
    }
    next();
  } catch(e) {
    reponse.status(401).json({status: "error", message: "Plan failed."});
  }
};