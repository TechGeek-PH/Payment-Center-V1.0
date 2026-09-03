/**
 * TechGeekPH centralized billing checkout for PayMongo Hosted Checkout.
 *
 * This module is intentionally separate from Code.gs. Code.gs only routes
 * the public actions to the prefixed functions below. API keys are stored in
 * Apps Script Properties and must never be copied into GitHub or config.js.
 */

const TGPM = Object.freeze({
  VERSION: '2026-09-03-test-v1',
  TIME_ZONE: 'Asia/Manila',
  CLIENTS_SHEET: 'Clients',
  LEDGER_SHEET: 'Billing Ledger',
  TRANSACTIONS_SHEET: 'PayMongo Transactions',
  DEFAULT_PUBLIC_URL: 'https://techgeek-ph.github.io/Payment-Center-V1.0/',
  DEFAULT_METHODS: ['gcash', 'qrph'],
  MAX_OPEN_BILLS: 24,
  MAX_RECONCILE_PER_RUN: 20,
  TRANSACTION_HEADERS: [
    'Created At',
    'Transaction ID',
    'Status',
    'Account No.',
    'Client Name',
    'Contact Number',
    'Billing IDs',
    'Billing Periods',
    'Expected Amount',
    'Currency',
    'Selected Method',
    'Gateway Checkout ID',
    'Checkout URL',
    'Gateway Payment ID',
    'Gateway Payment Status',
    'Gateway Reference',
    'Fee',
    'Net Amount',
    'Paid At',
    'Applied Amount',
    'Unapplied Amount',
    'Status Token Hash',
    'Last Checked',
    'Last Error',
    'Mode',
    'Updated At'
  ]
});

/**
 * Run once from the Apps Script editor while the main TechGeekPH billing
 * spreadsheet is open. This creates the transaction sheet and reconciliation
 * trigger, but does not enable checkout until a test key is saved.
 */
function setupPayMongoCheckout() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Open the TechGeekPH billing spreadsheet before running setupPayMongoCheckout().');
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('BILLING_SPREADSHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('PAYMENT_CENTER_SPREADSHEET_ID')) {
    properties.setProperty('PAYMENT_CENTER_SPREADSHEET_ID', spreadsheet.getId());
  }
  if (!properties.getProperty('PAYMONGO_PUBLIC_URL')) {
    properties.setProperty('PAYMONGO_PUBLIC_URL', TGPM.DEFAULT_PUBLIC_URL);
  }
  if (!properties.getProperty('PAYMONGO_PAYMENT_METHOD_TYPES')) {
    properties.setProperty('PAYMONGO_PAYMENT_METHOD_TYPES', TGPM.DEFAULT_METHODS.join(','));
  }
  if (!properties.getProperty('PAYMONGO_PASS_ON_FEES')) {
    properties.setProperty('PAYMONGO_PASS_ON_FEES', 'false');
  }

  tgpmEnsureTransactionSheet_();
  tgpmEnsureBillingLedgerColumns_();
  installPayMongoReconciliationTrigger();

  const status = tgpmGatewayStatus_();
  console.log(JSON.stringify(status));
  return status;
}

/**
 * Safely saves a PayMongo test key using a private Google Sheets prompt.
 * The key is written only to Apps Script Properties.
 */
function configurePayMongoTestKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'PayMongo Test Mode',
    'Paste the PayMongo TEST secret key that starts with sk_test_. It will be stored privately in Apps Script Properties.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return { ok: false, cancelled: true };

  const key = String(response.getResponseText() || '').trim();
  if (!/^sk_test_[A-Za-z0-9_-]{12,}$/.test(key)) {
    throw new Error('Invalid test key. Use the PayMongo secret key that starts with sk_test_.');
  }

  setupPayMongoCheckout();
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('PAYMONGO_SECRET_KEY', key);
  properties.setProperty('PAYMONGO_ENABLED', 'true');
  return tgpmGatewayStatus_();
}

/**
 * Run only after test payments post correctly to the Billing Ledger.
 */
function configurePayMongoLiveKey() {
  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.alert(
    'Activate PayMongo Live Mode?',
    'Use this only after the complete test-mode checklist passes. Real client payments will be accepted.',
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return { ok: false, cancelled: true };

  const response = ui.prompt(
    'PayMongo Live Mode',
    'Paste the PayMongo LIVE secret key that starts with sk_live_. It will be stored privately in Apps Script Properties.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return { ok: false, cancelled: true };

  const key = String(response.getResponseText() || '').trim();
  if (!/^sk_live_[A-Za-z0-9_-]{12,}$/.test(key)) {
    throw new Error('Invalid live key. Use the PayMongo secret key that starts with sk_live_.');
  }

  setupPayMongoCheckout();
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('PAYMONGO_SECRET_KEY', key);
  properties.setProperty('PAYMONGO_ENABLED', 'true');
  return tgpmGatewayStatus_();
}

function disablePayMongoCheckout() {
  PropertiesService.getScriptProperties().setProperty('PAYMONGO_ENABLED', 'false');
  return tgpmGatewayStatus_();
}

/**
 * Optional administrator helper. Example input: gcash,qrph,card
 * Only enable methods already activated in the PayMongo dashboard.
 */
function configurePayMongoPaymentMethods() {
  const ui = SpreadsheetApp.getUi();
  const current = tgpmConfiguredMethods_().join(',');
  const response = ui.prompt(
    'PayMongo payment methods',
    'Enter enabled PayMongo method codes separated by commas. Current: ' + current,
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return { ok: false, cancelled: true };

  const methods = tgpmSanitizeMethods_(String(response.getResponseText() || '').split(','));
  if (!methods.length) throw new Error('Enter at least one PayMongo payment method.');
  PropertiesService.getScriptProperties().setProperty('PAYMONGO_PAYMENT_METHOD_TYPES', methods.join(','));
  return tgpmGatewayStatus_();
}

function installPayMongoReconciliationTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'reconcilePayMongoPayments')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('reconcilePayMongoPayments')
    .timeBased()
    .everyMinutes(5)
    .create();

  return { ok: true, intervalMinutes: 5 };
}

/**
 * Public status used by the GitHub Pages frontend. It never returns a key.
 */
function tgpmGatewayStatus_() {
  const properties = PropertiesService.getScriptProperties();
  const key = String(properties.getProperty('PAYMONGO_SECRET_KEY') || '').trim();
  const enabled = properties.getProperty('PAYMONGO_ENABLED') === 'true';
  const mode = key.indexOf('sk_live_') === 0 ? 'live' : key.indexOf('sk_test_') === 0 ? 'test' : 'unconfigured';
  const missing = [];

  if (!key) missing.push('PayMongo secret key');
  if (!properties.getProperty('BILLING_SPREADSHEET_ID') && !properties.getProperty('PAYMENT_CENTER_SPREADSHEET_ID')) {
    missing.push('billing spreadsheet');
  }

  try {
    const spreadsheet = tgpmBillingSpreadsheet_();
    if (!spreadsheet.getSheetByName(TGPM.CLIENTS_SHEET)) missing.push(TGPM.CLIENTS_SHEET + ' sheet');
    if (!spreadsheet.getSheetByName(TGPM.LEDGER_SHEET)) missing.push(TGPM.LEDGER_SHEET + ' sheet');
    if (!spreadsheet.getSheetByName(TGPM.TRANSACTIONS_SHEET)) missing.push(TGPM.TRANSACTIONS_SHEET + ' sheet');
  } catch (error) {
    if (missing.indexOf('billing spreadsheet') === -1) missing.push('billing spreadsheet access');
  }

  return {
    ok: true,
    service: 'TechGeekPH PayMongo Checkout',
    version: TGPM.VERSION,
    configured: enabled && mode !== 'unconfigured' && missing.length === 0,
    enabled: enabled,
    mode: mode,
    paymentMethods: tgpmConfiguredMethods_(),
    passOnFees: properties.getProperty('PAYMONGO_PASS_ON_FEES') === 'true',
    missing: missing
  };
}

function tgpmHandlePostAction_(action, payload) {
  if (action === 'lookupBillingAccount') return tgpmLookupBillingAccount_(payload);
  if (action === 'createPayMongoCheckout') return tgpmCreateCheckout_(payload);
  if (action === 'checkPayMongoStatus') return tgpmCheckPublicStatus_(payload);
  throw new Error('Unknown PayMongo action: ' + action);
}

function tgpmLookupBillingAccount_(payload) {
  tgpmAssertGatewayReady_();
  const accountNo = tgpmClean_(payload.accountNo, 40).toUpperCase();
  const phone = tgpmNormalizePhone_(payload.phone);
  tgpmValidatePublicLookup_(accountNo, phone);
  tgpmRateLimit_('lookup', accountNo + '|' + phone, 8, 60);

  const client = tgpmVerifyClient_(accountNo, phone);
  const bills = tgpmFindOpenBills_(accountNo);
  if (!bills.length) {
    return {
      ok: true,
      hasBalance: false,
      accountNo: client.accountNo,
      clientName: client.clientName,
      message: 'Wala kang outstanding balance sa Billing Ledger.'
    };
  }

  return {
    ok: true,
    hasBalance: true,
    accountNo: client.accountNo,
    clientName: client.clientName,
    totalBalance: tgpmRoundMoney_(bills.reduce((sum, bill) => sum + bill.balance, 0)),
    currency: 'PHP',
    paymentMethods: tgpmConfiguredMethods_(),
    bills: bills.map(bill => ({
      billingId: bill.billingId,
      billingPeriod: bill.billingPeriod,
      amountDue: bill.amountDue,
      amountPaid: bill.amountPaid,
      balance: bill.balance,
      dueDate: bill.dueDate
    }))
  };
}

function tgpmCreateCheckout_(payload) {
  const gateway = tgpmAssertGatewayReady_();
  const accountNo = tgpmClean_(payload.accountNo, 40).toUpperCase();
  const phone = tgpmNormalizePhone_(payload.phone);
  const method = tgpmClean_(payload.paymentMethod, 40).toLowerCase();
  tgpmValidatePublicLookup_(accountNo, phone);
  tgpmRateLimit_('checkout', accountNo + '|' + phone, 4, 300);

  if (gateway.paymentMethods.indexOf(method) === -1) {
    throw new Error('The selected payment method is not currently enabled.');
  }

  const client = tgpmVerifyClient_(accountNo, phone);
  const bills = tgpmFindOpenBills_(accountNo);
  if (!bills.length) throw new Error('No outstanding balance was found for this account.');

  const totalBalance = tgpmRoundMoney_(bills.reduce((sum, bill) => sum + bill.balance, 0));
  if (!(totalBalance > 0)) throw new Error('No payable balance was found.');

  const transactionId = tgpmNextTransactionId_();
  const statusToken = tgpmRandomToken_();
  const publicUrl = tgpmPublicUrl_();
  const returnParams = 'reference=' + encodeURIComponent(transactionId) + '&token=' + encodeURIComponent(statusToken);
  const successUrl = tgpmAddQuery_(publicUrl, 'payment=success&' + returnParams);
  const cancelUrl = tgpmAddQuery_(publicUrl, 'payment=cancelled&' + returnParams);
  const billingIds = bills.map(bill => bill.billingId);
  const billingPeriods = bills.map(bill => bill.billingPeriod).filter(Boolean);

  const transaction = {
    createdAt: new Date(),
    transactionId: transactionId,
    status: 'CREATING',
    accountNo: client.accountNo,
    clientName: client.clientName,
    contactNumber: phone,
    billingIds: JSON.stringify(billingIds),
    billingPeriods: billingPeriods.join(', '),
    expectedAmount: totalBalance,
    currency: 'PHP',
    selectedMethod: method,
    statusTokenHash: tgpmHashToken_(statusToken),
    mode: gateway.mode
  };
  tgpmAppendTransaction_(transaction);

  const amountCentavos = Math.round(totalBalance * 100);
  const attributes = {
    line_items: [{
      name: 'TechGeekPH Internet Billing',
      description: 'Account ' + client.accountNo + (billingPeriods.length ? ' · ' + billingPeriods.join(', ') : ''),
      amount: amountCentavos,
      currency: 'PHP',
      quantity: 1
    }],
    payment_method_types: [method],
    success_url: successUrl,
    cancel_url: cancelUrl,
    description: 'TechGeekPH billing payment for ' + client.accountNo,
    reference_number: transactionId,
    send_email_receipt: false,
    show_description: true,
    show_line_items: true,
    pass_on_fees: PropertiesService.getScriptProperties().getProperty('PAYMONGO_PASS_ON_FEES') === 'true',
    metadata: {
      account_no: client.accountNo,
      primary_billing_id: billingIds[0] || '',
      billing_ids: billingIds.join(',').slice(0, 500),
      billing_periods: billingPeriods.join(',').slice(0, 500),
      expected_amount: totalBalance.toFixed(2),
      integration: TGPM.VERSION
    }
  };

  try {
    const response = tgpmPayMongoRequest_('post', '/v2/checkout_sessions', { data: { attributes: attributes } }, transactionId);
    const checkout = response && response.data ? response.data : {};
    const checkoutAttributes = checkout.attributes || {};
    const checkoutId = tgpmClean_(checkout.id, 120);
    const checkoutUrl = tgpmClean_(checkoutAttributes.checkout_url, 1000);

    if (!/^cs_[A-Za-z0-9_-]+$/.test(checkoutId) || !/^https:\/\/checkout\.paymongo\.com\//i.test(checkoutUrl)) {
      throw new Error('PayMongo did not return a valid checkout session.');
    }

    tgpmUpdateTransaction_(transactionId, {
      status: 'PENDING',
      gatewayCheckoutId: checkoutId,
      checkoutUrl: checkoutUrl,
      gatewayPaymentStatus: 'pending',
      lastChecked: new Date(),
      lastError: ''
    });

    return {
      ok: true,
      mode: gateway.mode,
      referenceNumber: transactionId,
      checkoutId: checkoutId,
      checkoutUrl: checkoutUrl,
      amount: totalBalance,
      currency: 'PHP',
      statusToken: statusToken
    };
  } catch (error) {
    tgpmUpdateTransaction_(transactionId, {
      status: 'FAILED',
      lastChecked: new Date(),
      lastError: tgpmSafeError_(error)
    });
    throw error;
  }
}

function tgpmCheckPublicStatus_(payload) {
  tgpmAssertGatewayReady_();
  const reference = tgpmClean_(payload.referenceNumber, 80).toUpperCase();
  const token = tgpmClean_(payload.statusToken, 200);
  if (!reference || !token) throw new Error('Payment reference and status token are required.');

  const transaction = tgpmGetTransaction_(reference);
  if (!transaction || !tgpmTokenMatches_(token, transaction.statusTokenHash)) {
    throw new Error('Payment status link is invalid or expired.');
  }

  return tgpmReconcileTransaction_(reference, false);
}

/**
 * Five-minute safety net. This posts payments even if the client closes the
 * browser before returning from PayMongo.
 */
function reconcilePayMongoPayments() {
  const gateway = tgpmGatewayStatus_();
  if (!gateway.configured) return { ok: false, skipped: true, reason: 'Gateway is not configured.' };

  const pending = tgpmListPendingTransactions_(TGPM.MAX_RECONCILE_PER_RUN);
  const results = [];
  pending.forEach(transaction => {
    try {
      results.push(tgpmReconcileTransaction_(transaction.transactionId, true));
    } catch (error) {
      tgpmUpdateTransaction_(transaction.transactionId, {
        lastChecked: new Date(),
        lastError: tgpmSafeError_(error)
      });
      results.push({ ok: false, referenceNumber: transaction.transactionId, message: tgpmSafeError_(error) });
    }
  });

  return { ok: true, checked: pending.length, results: results };
}

function tgpmReconcileTransaction_(transactionId, internalCall) {
  const transaction = tgpmGetTransaction_(transactionId);
  if (!transaction) throw new Error('Payment transaction was not found.');

  if (transaction.status === 'PAID' || transaction.status === 'PAID_NEEDS_REVIEW') {
    return tgpmPublicTransactionStatus_(transaction, true);
  }
  if (!transaction.gatewayCheckoutId) {
    return tgpmPublicTransactionStatus_(transaction, false);
  }

  const response = tgpmPayMongoRequest_(
    'get',
    '/v1/checkout_sessions/' + encodeURIComponent(transaction.gatewayCheckoutId),
    null,
    ''
  );
  const checkout = response && response.data ? response.data : {};
  const attributes = checkout.attributes || {};
  const returnedReference = tgpmClean_(attributes.reference_number, 80).toUpperCase();
  if (returnedReference && returnedReference !== transaction.transactionId) {
    throw new Error('PayMongo reference mismatch. Payment was not posted.');
  }

  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  const paidPayment = payments
    .filter(payment => payment && payment.attributes && String(payment.attributes.status).toLowerCase() === 'paid')
    .sort((a, b) => Number(b.attributes.paid_at || b.attributes.created_at || 0) - Number(a.attributes.paid_at || a.attributes.created_at || 0))[0];

  if (!paidPayment) {
    tgpmUpdateTransaction_(transaction.transactionId, {
      status: 'PENDING',
      gatewayPaymentStatus: 'pending',
      lastChecked: new Date(),
      lastError: ''
    });
    return tgpmPublicTransactionStatus_(tgpmGetTransaction_(transaction.transactionId), false);
  }

  const paymentAttributes = paidPayment.attributes || {};
  const currency = String(paymentAttributes.currency || 'PHP').toUpperCase();
  const paidAmount = tgpmRoundMoney_(Number(paymentAttributes.amount || 0) / 100);
  if (currency !== 'PHP' || paidAmount + 0.005 < transaction.expectedAmount) {
    tgpmUpdateTransaction_(transaction.transactionId, {
      status: 'PAID_NEEDS_REVIEW',
      gatewayPaymentId: tgpmClean_(paidPayment.id, 120),
      gatewayPaymentStatus: 'paid',
      gatewayReference: returnedReference || transaction.transactionId,
      lastChecked: new Date(),
      lastError: 'Paid amount or currency does not match the expected billing amount.'
    });
    return tgpmPublicTransactionStatus_(tgpmGetTransaction_(transaction.transactionId), true);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const latest = tgpmGetTransaction_(transaction.transactionId);
    if (latest.status === 'PAID' || latest.status === 'PAID_NEEDS_REVIEW') {
      return tgpmPublicTransactionStatus_(latest, true);
    }

    const applied = tgpmApplyPaymentToLedger_(latest, Math.min(latest.expectedAmount, paidAmount), paidPayment);
    const finalStatus = applied.unappliedAmount > 0.005 ? 'PAID_NEEDS_REVIEW' : 'PAID';
    const paidAtSeconds = Number(paymentAttributes.paid_at || paymentAttributes.created_at || 0);
    const paidAt = paidAtSeconds > 0 ? new Date(paidAtSeconds * 1000) : new Date();

    tgpmUpdateTransaction_(transaction.transactionId, {
      status: finalStatus,
      gatewayPaymentId: tgpmClean_(paidPayment.id, 120),
      gatewayPaymentStatus: 'paid',
      gatewayReference: returnedReference || transaction.transactionId,
      fee: tgpmRoundMoney_(Number(paymentAttributes.fee || 0) / 100),
      netAmount: tgpmRoundMoney_(Number(paymentAttributes.net_amount || 0) / 100),
      paidAt: paidAt,
      appliedAmount: applied.appliedAmount,
      unappliedAmount: applied.unappliedAmount,
      lastChecked: new Date(),
      lastError: applied.unappliedAmount > 0.005 ? 'Payment received, but part of the amount needs manual allocation.' : ''
    });
  } finally {
    lock.releaseLock();
  }

  const updated = tgpmGetTransaction_(transaction.transactionId);
  return tgpmPublicTransactionStatus_(updated, true);
}

function tgpmApplyPaymentToLedger_(transaction, creditAmount, paidPayment) {
  const spreadsheet = tgpmBillingSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TGPM.LEDGER_SHEET);
  if (!sheet) throw new Error(TGPM.LEDGER_SHEET + ' sheet was not found.');

  const map = tgpmHeaderMap_(sheet);
  const billingIdColumn = tgpmRequireColumn_(map, ['billingid'], 'billing_id');
  const amountDueColumn = tgpmRequireColumn_(map, ['amountdue'], 'amount_due');
  const amountPaidColumn = tgpmRequireColumn_(map, ['amountpaid'], 'amount_paid');
  const balanceColumn = tgpmRequireColumn_(map, ['balance'], 'balance');
  const statusColumn = tgpmRequireColumn_(map, ['billingstatus', 'paymentstatus'], 'billing_status');
  const lastPaymentColumn = tgpmFindColumn_(map, ['lastpaymentdate', 'paymentdate']);
  const referenceColumn = tgpmFindColumn_(map, ['paymentreference', 'referencenumber', 'reference']);
  const methodColumn = tgpmFindColumn_(map, ['paymentmethod']);
  const lastUpdatedColumn = tgpmFindColumn_(map, ['lastupdated']);

  const billingIds = tgpmParseJsonArray_(transaction.billingIds);
  const values = sheet.getDataRange().getValues();
  const rowsById = {};
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const id = tgpmClean_(values[rowIndex][billingIdColumn - 1], 120);
    if (id) rowsById[id] = rowIndex + 1;
  }

  let remaining = tgpmRoundMoney_(creditAmount);
  let applied = 0;
  const paymentMethod = tgpmPaymentSourceType_(paidPayment) || transaction.selectedMethod;
  const reference = transaction.transactionId + (paidPayment.id ? ' / ' + paidPayment.id : '');
  const now = new Date();

  billingIds.forEach(billingId => {
    if (remaining <= 0.005) return;
    const rowNumber = rowsById[billingId];
    if (!rowNumber) return;

    const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    const amountDue = tgpmMoney_(row[amountDueColumn - 1]);
    const currentPaid = tgpmMoney_(row[amountPaidColumn - 1]);
    const storedBalance = tgpmMoney_(row[balanceColumn - 1]);
    const currentBalance = storedBalance > 0 ? storedBalance : Math.max(0, amountDue - currentPaid);
    if (currentBalance <= 0.005) return;

    const allocation = tgpmRoundMoney_(Math.min(currentBalance, remaining));
    const newPaid = tgpmRoundMoney_(currentPaid + allocation);
    const newBalance = tgpmRoundMoney_(Math.max(0, currentBalance - allocation));
    const newStatus = newBalance <= 0.005 ? 'PAID' : 'PARTIALLY PAID';

    sheet.getRange(rowNumber, amountPaidColumn).setValue(newPaid);
    sheet.getRange(rowNumber, balanceColumn).setValue(newBalance);
    sheet.getRange(rowNumber, statusColumn).setValue(newStatus);
    if (lastPaymentColumn) sheet.getRange(rowNumber, lastPaymentColumn).setValue(now);
    if (referenceColumn) sheet.getRange(rowNumber, referenceColumn).setValue(reference);
    if (methodColumn) sheet.getRange(rowNumber, methodColumn).setValue('PayMongo · ' + paymentMethod.toUpperCase());
    if (lastUpdatedColumn) sheet.getRange(rowNumber, lastUpdatedColumn).setValue(now);

    applied = tgpmRoundMoney_(applied + allocation);
    remaining = tgpmRoundMoney_(remaining - allocation);
  });

  SpreadsheetApp.flush();
  return { appliedAmount: applied, unappliedAmount: Math.max(0, remaining) };
}

function tgpmVerifyClient_(accountNo, phone) {
  const sheet = tgpmBillingSpreadsheet_().getSheetByName(TGPM.CLIENTS_SHEET);
  if (!sheet) throw new Error(TGPM.CLIENTS_SHEET + ' sheet was not found.');
  const map = tgpmHeaderMap_(sheet);
  const accountColumn = tgpmRequireColumn_(map, ['accountno', 'accountnumber'], 'Account No.');
  const phoneColumn = tgpmRequireColumn_(map, ['phone', 'contactnumber', 'mobilenumber'], 'Phone');
  const nameColumn = tgpmRequireColumn_(map, ['clientname', 'subscribername', 'name'], 'Client Name');
  const values = sheet.getDataRange().getDisplayValues();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowAccount = tgpmClean_(values[rowIndex][accountColumn - 1], 40).toUpperCase();
    const rowPhone = tgpmNormalizeStoredPhone_(values[rowIndex][phoneColumn - 1]);
    if (rowAccount === accountNo && rowPhone === phone) {
      return {
        rowNumber: rowIndex + 1,
        accountNo: rowAccount,
        clientName: tgpmClean_(values[rowIndex][nameColumn - 1], 120)
      };
    }
  }

  throw new Error('Hindi nagtugma ang account number at registered mobile number.');
}

function tgpmFindOpenBills_(accountNo) {
  const sheet = tgpmBillingSpreadsheet_().getSheetByName(TGPM.LEDGER_SHEET);
  if (!sheet) throw new Error(TGPM.LEDGER_SHEET + ' sheet was not found.');
  const map = tgpmHeaderMap_(sheet);
  const billingIdColumn = tgpmRequireColumn_(map, ['billingid'], 'billing_id');
  const accountColumn = tgpmRequireColumn_(map, ['accountno', 'accountnumber'], 'account_no');
  const periodColumn = tgpmFindColumn_(map, ['billingperiod', 'period']);
  const amountDueColumn = tgpmRequireColumn_(map, ['amountdue', 'currentbill', 'monthlybill'], 'amount_due');
  const amountPaidColumn = tgpmFindColumn_(map, ['amountpaid']);
  const balanceColumn = tgpmFindColumn_(map, ['balance']);
  const statusColumn = tgpmFindColumn_(map, ['billingstatus', 'paymentstatus']);
  const dueDateColumn = tgpmFindColumn_(map, ['duedate']);
  const values = sheet.getDataRange().getValues();
  const bills = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (tgpmClean_(row[accountColumn - 1], 40).toUpperCase() !== accountNo) continue;

    const billingId = tgpmClean_(row[billingIdColumn - 1], 120);
    if (!billingId) continue;
    const amountDue = tgpmMoney_(row[amountDueColumn - 1]);
    const amountPaid = amountPaidColumn ? tgpmMoney_(row[amountPaidColumn - 1]) : 0;
    const storedBalance = balanceColumn ? tgpmMoney_(row[balanceColumn - 1]) : 0;
    const balance = tgpmRoundMoney_(storedBalance > 0 ? storedBalance : Math.max(0, amountDue - amountPaid));
    const status = statusColumn ? tgpmClean_(row[statusColumn - 1], 60).toUpperCase() : '';
    if (balance <= 0.005 || ['PAID', 'VOID', 'VOIDED', 'CANCELLED', 'WAIVED'].indexOf(status) !== -1) continue;

    const dueValue = dueDateColumn ? row[dueDateColumn - 1] : '';
    bills.push({
      rowNumber: rowIndex + 1,
      billingId: billingId,
      billingPeriod: periodColumn ? tgpmDisplayValue_(row[periodColumn - 1]) : '',
      amountDue: amountDue,
      amountPaid: amountPaid,
      balance: balance,
      dueDate: tgpmDisplayDate_(dueValue),
      dueTimestamp: dueValue instanceof Date ? dueValue.getTime() : Date.parse(String(dueValue || '')) || 0
    });
  }

  return bills
    .sort((a, b) => a.dueTimestamp - b.dueTimestamp || a.rowNumber - b.rowNumber)
    .slice(0, TGPM.MAX_OPEN_BILLS);
}

function tgpmPayMongoRequest_(method, path, payload, idempotencyKey) {
  const key = String(PropertiesService.getScriptProperties().getProperty('PAYMONGO_SECRET_KEY') || '').trim();
  if (!/^sk_(?:test|live)_/.test(key)) throw new Error('PayMongo secret key is not configured.');

  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(key + ':'),
      Accept: 'application/json'
    }
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  if (idempotencyKey) options.headers['Idempotency-Key'] = idempotencyKey;

  const response = UrlFetchApp.fetch('https://api.paymongo.com' + path, options);
  const code = response.getResponseCode();
  const raw = response.getContentText();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

  if (code < 200 || code >= 300) {
    throw new Error(tgpmPayMongoErrorMessage_(data, code));
  }
  return data;
}

function tgpmPayMongoErrorMessage_(data, code) {
  const errors = data && Array.isArray(data.errors) ? data.errors : [];
  const messages = errors.map(error => {
    const detail = error && error.detail ? error.detail : error && error.code ? error.code : '';
    return tgpmClean_(detail, 180);
  }).filter(Boolean);
  return 'PayMongo request failed (' + code + ')' + (messages.length ? ': ' + messages.join('; ') : '.');
}

function tgpmAssertGatewayReady_() {
  const status = tgpmGatewayStatus_();
  if (!status.configured) {
    throw new Error('Online checkout is not configured yet' + (status.missing.length ? ': ' + status.missing.join(', ') : '.'));
  }
  return status;
}

function tgpmValidatePublicLookup_(accountNo, phone) {
  if (!/^[A-Z0-9-]{4,40}$/.test(accountNo)) throw new Error('Enter a valid TechGeekPH account number.');
  if (!/^09\d{9}$/.test(phone)) throw new Error('Enter the complete 11-digit registered mobile number.');
}

function tgpmRateLimit_(scope, identity, limit, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const digest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, scope + '|' + identity)
  ).slice(0, 36);
  const key = 'tgpm-rate-' + digest;
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), ttlSeconds);
  if (count > limit) throw new Error('Too many attempts. Please wait a few minutes and try again.');
}

function tgpmBillingSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty('BILLING_SPREADSHEET_ID') || properties.getProperty('PAYMENT_CENTER_SPREADSHEET_ID');
  if (!id) throw new Error('Billing spreadsheet is not configured.');
  return SpreadsheetApp.openById(id);
}

function tgpmEnsureTransactionSheet_() {
  const spreadsheet = tgpmBillingSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(TGPM.TRANSACTIONS_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(TGPM.TRANSACTIONS_SHEET);
  if (sheet.getMaxColumns() < TGPM.TRANSACTION_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), TGPM.TRANSACTION_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, TGPM.TRANSACTION_HEADERS.length).setValues([TGPM.TRANSACTION_HEADERS]);
  sheet.getRange(1, 1, 1, TGPM.TRANSACTION_HEADERS.length)
    .setBackground('#0d3b66')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('I2:I').setNumberFormat('₱#,##0.00');
  sheet.getRange('Q2:R').setNumberFormat('₱#,##0.00');
  sheet.getRange('T2:U').setNumberFormat('₱#,##0.00');
  return sheet;
}

function tgpmEnsureBillingLedgerColumns_() {
  const spreadsheet = tgpmBillingSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TGPM.LEDGER_SHEET);
  if (!sheet) throw new Error(TGPM.LEDGER_SHEET + ' sheet was not found.');
  const required = [
    ['amountpaid', 'amount_paid'],
    ['balance', 'balance'],
    ['billingstatus', 'billing_status'],
    ['lastpaymentdate', 'last_payment_date'],
    ['paymentreference', 'payment_reference'],
    ['paymentmethod', 'payment_method'],
    ['lastupdated', 'last_updated']
  ];
  let map = tgpmHeaderMap_(sheet);
  required.forEach(item => {
    if (!map[item[0]]) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(item[1]);
      map = tgpmHeaderMap_(sheet);
    }
  });
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
}

function tgpmAppendTransaction_(data) {
  const sheet = tgpmEnsureTransactionSheet_();
  const row = tgpmTransactionRow_(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function tgpmUpdateTransaction_(transactionId, changes) {
  const sheet = tgpmEnsureTransactionSheet_();
  const map = tgpmHeaderMap_(sheet);
  const idColumn = tgpmRequireColumn_(map, ['transactionid'], 'Transaction ID');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('PayMongo transaction was not found.');
  const ids = sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues().flat();
  const index = ids.findIndex(value => tgpmClean_(value, 80).toUpperCase() === String(transactionId).toUpperCase());
  if (index < 0) throw new Error('PayMongo transaction was not found.');
  const rowNumber = index + 2;
  const fieldMap = tgpmTransactionFieldMap_();

  Object.keys(changes).forEach(key => {
    const header = fieldMap[key];
    const column = header ? map[tgpmNormalizeHeader_(header)] : 0;
    if (column) sheet.getRange(rowNumber, column).setValue(changes[key]);
  });
  const updatedColumn = map.updatedat;
  if (updatedColumn) sheet.getRange(rowNumber, updatedColumn).setValue(new Date());
}

function tgpmGetTransaction_(transactionId) {
  const sheet = tgpmEnsureTransactionSheet_();
  const map = tgpmHeaderMap_(sheet);
  const values = sheet.getDataRange().getValues();
  const idColumn = tgpmRequireColumn_(map, ['transactionid'], 'Transaction ID');
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (tgpmClean_(values[rowIndex][idColumn - 1], 80).toUpperCase() === String(transactionId).toUpperCase()) {
      return tgpmTransactionObject_(values[rowIndex], map, rowIndex + 1);
    }
  }
  return null;
}

function tgpmListPendingTransactions_(limit) {
  const sheet = tgpmEnsureTransactionSheet_();
  const map = tgpmHeaderMap_(sheet);
  const values = sheet.getDataRange().getValues();
  const statuses = ['CREATING', 'PENDING'];
  const cutoff = Date.now() - 31 * 24 * 60 * 60 * 1000;
  return values.slice(1).map((row, index) => tgpmTransactionObject_(row, map, index + 2))
    .filter(item => statuses.indexOf(item.status) !== -1 && item.gatewayCheckoutId && (!item.createdAt || item.createdAt.getTime() >= cutoff))
    .slice(0, limit);
}

function tgpmTransactionRow_(data) {
  const byHeader = {};
  const fieldMap = tgpmTransactionFieldMap_();
  Object.keys(data).forEach(key => {
    const header = fieldMap[key];
    if (header) byHeader[header] = data[key];
  });
  byHeader['Updated At'] = new Date();
  return TGPM.TRANSACTION_HEADERS.map(header => Object.prototype.hasOwnProperty.call(byHeader, header) ? byHeader[header] : '');
}

function tgpmTransactionObject_(row, map, rowNumber) {
  const get = names => {
    const column = tgpmFindColumn_(map, names);
    return column ? row[column - 1] : '';
  };
  return {
    rowNumber: rowNumber,
    createdAt: get(['createdat']) instanceof Date ? get(['createdat']) : null,
    transactionId: tgpmClean_(get(['transactionid']), 80).toUpperCase(),
    status: tgpmClean_(get(['status']), 60).toUpperCase(),
    accountNo: tgpmClean_(get(['accountno']), 40).toUpperCase(),
    clientName: tgpmClean_(get(['clientname']), 120),
    contactNumber: tgpmClean_(get(['contactnumber']), 30),
    billingIds: String(get(['billingids']) || '[]'),
    billingPeriods: tgpmClean_(get(['billingperiods']), 500),
    expectedAmount: tgpmMoney_(get(['expectedamount'])),
    currency: tgpmClean_(get(['currency']), 10).toUpperCase(),
    selectedMethod: tgpmClean_(get(['selectedmethod']), 40).toLowerCase(),
    gatewayCheckoutId: tgpmClean_(get(['gatewaycheckoutid']), 120),
    checkoutUrl: tgpmClean_(get(['checkouturl']), 1000),
    gatewayPaymentId: tgpmClean_(get(['gatewaypaymentid']), 120),
    gatewayPaymentStatus: tgpmClean_(get(['gatewaypaymentstatus']), 60),
    gatewayReference: tgpmClean_(get(['gatewayreference']), 120),
    fee: tgpmMoney_(get(['fee'])),
    netAmount: tgpmMoney_(get(['netamount'])),
    paidAt: get(['paidat']),
    appliedAmount: tgpmMoney_(get(['appliedamount'])),
    unappliedAmount: tgpmMoney_(get(['unappliedamount'])),
    statusTokenHash: tgpmClean_(get(['statustokenhash']), 200),
    mode: tgpmClean_(get(['mode']), 20)
  };
}

function tgpmTransactionFieldMap_() {
  return {
    createdAt: 'Created At',
    transactionId: 'Transaction ID',
    status: 'Status',
    accountNo: 'Account No.',
    clientName: 'Client Name',
    contactNumber: 'Contact Number',
    billingIds: 'Billing IDs',
    billingPeriods: 'Billing Periods',
    expectedAmount: 'Expected Amount',
    currency: 'Currency',
    selectedMethod: 'Selected Method',
    gatewayCheckoutId: 'Gateway Checkout ID',
    checkoutUrl: 'Checkout URL',
    gatewayPaymentId: 'Gateway Payment ID',
    gatewayPaymentStatus: 'Gateway Payment Status',
    gatewayReference: 'Gateway Reference',
    fee: 'Fee',
    netAmount: 'Net Amount',
    paidAt: 'Paid At',
    appliedAmount: 'Applied Amount',
    unappliedAmount: 'Unapplied Amount',
    statusTokenHash: 'Status Token Hash',
    lastChecked: 'Last Checked',
    lastError: 'Last Error',
    mode: 'Mode'
  };
}

function tgpmPublicTransactionStatus_(transaction, received) {
  const needsReview = transaction.status === 'PAID_NEEDS_REVIEW';
  return {
    ok: true,
    referenceNumber: transaction.transactionId,
    paymentReceived: Boolean(received),
    posted: transaction.status === 'PAID',
    needsReview: needsReview,
    status: transaction.status || 'PENDING',
    amount: transaction.expectedAmount,
    currency: transaction.currency || 'PHP',
    accountNo: transaction.accountNo,
    billingPeriods: transaction.billingPeriods,
    paymentMethod: transaction.selectedMethod,
    paidAt: transaction.paidAt instanceof Date ? transaction.paidAt.toISOString() : '',
    message: transaction.status === 'PAID'
      ? 'Payment received and posted to your Billing Ledger.'
      : needsReview
        ? 'Payment received. Billing review is required before final posting.'
        : 'Waiting for PayMongo payment confirmation.'
  };
}

function tgpmConfiguredMethods_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PAYMONGO_PAYMENT_METHOD_TYPES') || TGPM.DEFAULT_METHODS.join(',');
  return tgpmSanitizeMethods_(raw.split(','));
}

function tgpmSanitizeMethods_(methods) {
  const allowedPattern = /^[a-z][a-z0-9_]{1,39}$/;
  return Array.from(new Set((methods || [])
    .map(method => String(method || '').trim().toLowerCase())
    .filter(method => allowedPattern.test(method))));
}

function tgpmPublicUrl_() {
  const value = tgpmClean_(PropertiesService.getScriptProperties().getProperty('PAYMONGO_PUBLIC_URL') || TGPM.DEFAULT_PUBLIC_URL, 1000);
  if (!/^https:\/\//i.test(value)) throw new Error('PAYMONGO_PUBLIC_URL must use HTTPS.');
  return value;
}

function tgpmAddQuery_(url, query) {
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + query;
}

function tgpmNextTransactionId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const datePart = Utilities.formatDate(new Date(), TGPM.TIME_ZONE, 'yyyyMMdd');
    const key = 'TGPM_SEQUENCE_' + datePart;
    const next = Number(properties.getProperty(key) || 0) + 1;
    properties.setProperty(key, String(next));
    return 'TGPM-' + datePart + '-' + String(next).padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

function tgpmRandomToken_() {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + '|' + Utilities.getUuid() + '|' + Date.now()
  )).replace(/=+$/g, '');
}

function tgpmHashToken_(token) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || '')
  )).replace(/=+$/g, '');
}

function tgpmTokenMatches_(token, expectedHash) {
  return Boolean(token && expectedHash && tgpmHashToken_(token) === expectedHash);
}

function tgpmPaymentSourceType_(payment) {
  const source = payment && payment.attributes ? payment.attributes.source : null;
  if (!source) return '';
  return tgpmClean_(source.type || (source.attributes && source.attributes.type), 40).toLowerCase();
}

function tgpmHeaderMap_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  return headers.reduce((map, header, index) => {
    const key = tgpmNormalizeHeader_(header);
    if (key && !map[key]) map[key] = index + 1;
    return map;
  }, {});
}

function tgpmNormalizeHeader_(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tgpmFindColumn_(map, names) {
  for (let i = 0; i < names.length; i++) {
    const key = tgpmNormalizeHeader_(names[i]);
    if (map[key]) return map[key];
  }
  return 0;
}

function tgpmRequireColumn_(map, names, label) {
  const column = tgpmFindColumn_(map, names);
  if (!column) throw new Error('Missing required column in Billing Ledger: ' + label);
  return column;
}

function tgpmNormalizePhone_(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return '0' + digits.slice(2);
  return digits;
}

function tgpmNormalizeStoredPhone_(value) {
  const candidates = String(value == null ? '' : value).split(/[\/,;|]/);
  for (let i = 0; i < candidates.length; i++) {
    const normalized = tgpmNormalizePhone_(candidates[i]);
    if (/^09\d{9}$/.test(normalized)) return normalized;
  }
  return tgpmNormalizePhone_(value);
}

function tgpmMoney_(value) {
  if (typeof value === 'number') return tgpmRoundMoney_(value);
  const parsed = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? tgpmRoundMoney_(parsed) : 0;
}

function tgpmRoundMoney_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function tgpmDisplayDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return tgpmClean_(value, 80);
  return Utilities.formatDate(date, TGPM.TIME_ZONE, 'MMM d, yyyy');
}

function tgpmDisplayValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TGPM.TIME_ZONE, 'yyyy-MM');
  return tgpmClean_(value, 100);
}

function tgpmParseJsonArray_(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(item => tgpmClean_(item, 120)).filter(Boolean) : [];
  } catch (_) {
    return String(value || '').split(',').map(item => tgpmClean_(item, 120)).filter(Boolean);
  }
}

function tgpmClean_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength || 500);
}

function tgpmSafeError_(error) {
  return tgpmClean_(error && error.message ? error.message : String(error || 'Unexpected error'), 500);
}

