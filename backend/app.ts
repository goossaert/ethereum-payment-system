import express from 'express';
import bodyparser from 'body-parser';
import mongoose from 'mongoose';

import { DBCONFIG } from "./configs";
import { PORT } from './configs';

import { userRouter } from './routes/user.route';
import { paymentRouter } from './routes/payment.route';


(async () => {
    const app = express();
  
    mongoose.connect(DBCONFIG);

    app.use(bodyparser.json());
    app.use(bodyparser.urlencoded({ extended: true }));

    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS"
      );
      next();
    });

    app.use('/api/user', userRouter);
    app.use('/api/payment', paymentRouter);

    app.listen(PORT, () => {
      return console.log(`server is listening on ${PORT}`);
    });

  })();

