# TechGeekPH PayMongo Checkout Setup

This setup keeps the existing manual payment channels available while the new centralized checkout is tested. The live page switches to the centralized flow only when the Apps Script gateway reports that it is fully configured.

## Before you begin

- Complete PayMongo account verification.
- In PayMongo, confirm that **GCash** and/or **QR Ph** are enabled under your payment methods.
- Use a PayMongo **test secret key** first. Never put a secret key in `config.js`, `index.html`, GitHub, Messenger, or screenshots.
- The billing spreadsheet must contain the `Clients` and `Billing Ledger` tabs.

The integration recognizes these existing fields by header name:

- `Clients`: `Account No.`, `Client Name`, and `Phone`
- `Billing Ledger`: `billing_id`, `billing_period`, `account_no`, `amount_due`, `amount_paid`, `balance`, `billing_status`, and `due_date`

The setup helper adds the payment-posting columns if they are missing. It never deletes existing ledger columns or records.

## 1. Add the Apps Script files

Open the main TechGeekPH billing spreadsheet, then open **Extensions → Apps Script**.

1. Replace the existing `Code.gs` with the version in this branch.
2. Create a new script file named `PayMongoCheckout.gs`.
3. Paste the complete contents of `PayMongoCheckout.gs` from this folder.
4. Keep the existing `appsscript.json` manifest.

## 2. Initialize the billing integration

From the function selector, run:

```javascript
setupPayMongoCheckout
```

Approve the requested Google permissions. This action:

- links the active spreadsheet as the billing data source;
- creates the `PayMongo Transactions` audit tab;
- verifies/adds the required payment-posting columns; and
- installs the five-minute payment reconciliation trigger.

## 3. Save the test key privately

In PayMongo, open **Settings → Developers** and copy the secret test key beginning with `sk_test_`.

Run this Apps Script function:

```javascript
configurePayMongoTestKey
```

Paste the key only into the private Google prompt. The function stores it in Apps Script Properties; it is not written to the spreadsheet or repository.

## 4. Select the enabled payment methods

Run:

```javascript
configurePayMongoPaymentMethods
```

For the initial test, enter:

```text
gcash,qrph
```

Only include methods activated on the PayMongo account. If GCash is not yet enabled, use `qrph` by itself until PayMongo activates GCash.

## 5. Redeploy the Apps Script Web App

Create a **new deployment version** using:

- Execute as: **Me**
- Who has access: **Anyone**

Keep the same deployed `/exec` URL in `config.js` when Google retains it. If Google provides a different URL, update only `apiUrl` in `config.js`.

## 6. Test the complete flow

Use a test client that has:

- a matching account number and full registered 11-digit mobile number in `Clients`; and
- an unpaid record with a positive balance in `Billing Ledger`.

Verify all of the following:

1. The client can retrieve only the matching account.
2. The displayed total equals the ledger balance.
3. Selecting GCash or QR Ph opens a PayMongo test checkout.
4. A successful PayMongo test transaction creates or updates the matching row in `PayMongo Transactions`.
5. The ledger changes to `PAID` when the balance reaches zero.
6. A repeated status check does not post the payment twice.
7. A cancelled checkout does not change the ledger.

The returning client receives an immediate status check. If the client closes the browser, the installed trigger securely retrieves pending checkout sessions from PayMongo every five minutes and posts confirmed payments.

## 7. Activate live payments

Only after the full test checklist passes, copy the PayMongo live secret key beginning with `sk_live_`, then run:

```javascript
configurePayMongoLiveKey
```

Confirm the warning and paste the live key into the Google prompt. Run one small controlled live payment before sharing the page with all clients.

To stop online checkout at any time while preserving the manual payment page, run:

```javascript
disablePayMongoCheckout
```

## Posting behavior

- The payable amount always comes from the server-side Billing Ledger, never from a client-entered amount.
- Confirmed payments are allocated to open billing records from oldest to newest.
- A zero balance is tagged `PAID`; a remaining balance is tagged `PARTIALLY PAID`.
- Duplicate reconciliation is blocked by the unique TechGeekPH transaction reference.
- If a payment no longer matches the ledger amount, it is tagged `PAID_NEEDS_REVIEW` rather than being posted incorrectly.
- PayMongo fees are absorbed by TechGeekPH by default. They are not added to the client's bill unless `PAYMONGO_PASS_ON_FEES` is deliberately changed to `true` in Apps Script Properties.

