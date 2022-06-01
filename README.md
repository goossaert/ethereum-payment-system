# ethereum-payment-system
A basic payment system for the Ethereum blockchain using TypeScript and Node.js

You can read more about this project in this article: https://codecapsule.com/2022/06/01/building-payment-system-ethereum/

# Tested use cases

The following use cases and product flows have been tested.

## A) User has no plans — show products as available for purchase
1. Connect and sign with wallet
2. Product page shows options to buy

## B) User has a plan — show products as disabled
1. Connect and sign with wallet
2. Product page shows current plan, and options to buy are greyed out

## C) User has a no plan — user buys product truthfully
1. Select product on product page
2. Click payment
3. Transaction is found by backend, plan is activated.
4. Access granted.

## D) User has a no plan — user gets whitelisted
1. Select whitelist product on product page
2. Click payment
3. Whitelist is found by backend, plan is activated.
4. Access granted.

## E) User has a no plan — user buys product and changes price when paying
_This scenario is not testable via a wallet because there is no way to update the amount. However, an attacker could call the API programmatically and this test is here to ensure this cannot be exploited._
1. Select product on product page
2. Click payment
3. User changes value.
4. Transaction is found by backend, and rejected.
5. Access denied.

## F) User with plan tries to buy while signed out
1. User is signed out.
2. User selects a plan and clicks buys
3. User should get rejected.
4. Transaction is not possible.

## G) Plan expired — user loses access
1. User can access restricted page
2. Once “valid_until” date is met, the user loses access to that data.


MIT License - Copyright (c) 2022 Emmanuel Goossaert