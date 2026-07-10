/**
 * TechGeekPH Payment Center API
 * Google Apps Script backend for a GitHub Pages payment form.
 *
 * FIRST-TIME SETUP
 * 1. Create/open the Google Sheet that will store the records.
 * 2. Open Extensions > Apps Script.
 * 3. Replace Code.gs with this file and add appsscript.json.
 * 4. Run setupPaymentCenter() once and approve access.
 * 5. Deploy as a Web app: Execute as Me; access Anyone.
 * 6. Paste the /exec deployment URL into config.js on GitHub.
 */

const PAYMENT_CENTER = Object.freeze({
  TIME_ZONE: 'Asia/Manila',
  SETTINGS_SHEET: 'Settings',
  METHODS_SHEET: 'Payment Methods',
  PAYMENTS_SHEET: 'Payments',
  SCREENSHOT_FOLDER_NAME: 'TechGeekPH Payment Screenshots',
  OCR_FOLDER_NAME: 'TechGeekPH Payment OCR Temp',
  DEFAULT_MAX_UPLOAD_MB: 5,
  DEFAULT_STATUS: 'Pending Verification',
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/webp'],
  SETTINGS_HEADERS: ['Key', 'Value', 'Description'],
  METHOD_HEADERS: [
    'ID',
    'Label',
    'Account Name',
    'Account Number',
    'QR Image URL',
    'Active',
    'Sort Order',
    'Notes',
    'Created At',
    'Updated At'
  ],
  PAYMENT_HEADERS: [
    'Timestamp',
    'Payment ID',
    'Status',
    'Client Account Number',
    'Client Name',
    'Contact Number',
    'Payment Method ID',
    'Payment Method Label',
    'Receiving Account Name',
    'Receiving Account Number',
    'Amount Submitted',
    'Payment Date',
    'Reference Number Submitted',
    'Detected Reference Number',
    'Detected Amount',
    'Screenshot URL',
    'Screenshot File ID',
    'Screenshot Filename',
    'OCR Status',
    'OCR Text',
    'Notes',
    'Page URL',
    'User Agent',
    'Client Submitted At',
    'Verified By',
    'Verified At',
    'Admin Notes',
    'Last Updated'
  ]
});

const DEFAULT_PAYMENT_METHODS = Object.freeze([
    { id: 'GOTYME-001', label: 'GoTyme Bank', accountName: 'Mark Corona De Mesa', accountNumber: '019772179572', qrImageUrl: 'assets/qr/gotyme-bank.png', active: true, sortOrder: 1, notes: 'Scan the QR code or transfer using the account number shown.' },
    { id: 'BPI-001', label: 'BPI Bank', accountName: 'Mark De Mesa', accountNumber: '9869013474', qrImageUrl: 'assets/qr/bpi-bank.png', active: true, sortOrder: 2, notes: 'Scan the QR code or transfer using the account number shown.' },
    { id: 'UNIONBANK-001', label: 'UnionBank', accountName: 'Mark De Mesa', accountNumber: '109480124887', qrImageUrl: 'assets/qr/union-bank.png', active: true, sortOrder: 3, notes: 'Scan the QR code or transfer using the account number shown.' },
    { id: 'MARIBANK-001', label: 'Mari Bank', accountName: 'Mark De Mesa', accountNumber: '11624449510', qrImageUrl: 'assets/qr/mari-bank.png', active: true, sortOrder: 4, notes: 'Scan the QR code or transfer using the account number shown.' },
    { id: 'GCASH-001', label: 'GCash Option #1', accountName: 'Mark De Mesa', accountNumber: '09950466591', qrImageUrl: 'assets/qr/gcash-option-1.png', active: true, sortOrder: 5, notes: 'Scan the QR code or send to the mobile number shown.' },
    { id: 'GCASH-002', label: 'GCash Option #2', accountName: 'Mark De Mesa', accountNumber: '09926020173', qrImageUrl: 'assets/qr/gcash-option-2.png', active: true, sortOrder: 6, notes: 'Scan the QR code or send to the mobile number shown.' },
    { id: 'GCASH-003', label: 'GCash Option #3', accountName: 'Kimberly Jill De Mesa', accountNumber: '09937418007', qrImageUrl: 'assets/qr/gcash-option-3.png', active: true, sortOrder: 7, notes: 'Scan the QR code or send to the mobile number shown.' }
]);

/**
 * Run once from the Apps Script editor.
 * Creates all sheets, folders, headers, settings, and all configured payment accounts.
 */
function setupPaymentCenter() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Open this Apps Script project from the Google Sheet, then run setupPaymentCenter() again.');
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('PAYMENT_CENTER_SPREADSHEET_ID', spreadsheet.getId());

  const settingsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.SETTINGS_SHEET, PAYMENT_CENTER.SETTINGS_HEADERS);
  const methodsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.METHODS_SHEET, PAYMENT_CENTER.METHOD_HEADERS);
  const paymentsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.PAYMENTS_SHEET, PAYMENT_CENTER.PAYMENT_HEADERS);

  const screenshotFolder = getOrCreateFolderByName_(PAYMENT_CENTER.SCREENSHOT_FOLDER_NAME);
  const ocrFolder = getOrCreateFolderByName_(PAYMENT_CENTER.OCR_FOLDER_NAME);

  upsertSetting_(settingsSheet, 'BUSINESS_NAME', 'TechGeekPH Solutions & Services Inc.', 'Displayed business name');
  upsertSetting_(settingsSheet, 'BRANCH_NAME', 'Sta. Ana Branch', 'Displayed branch name');
  upsertSetting_(settingsSheet, 'SUPPORT_CONTACT', '0965 075 3950', 'Billing support contact');
  upsertSetting_(settingsSheet, 'SCREENSHOT_FOLDER_ID', screenshotFolder.getId(), 'Private Google Drive folder for payment screenshots');
  upsertSetting_(settingsSheet, 'OCR_TEMP_FOLDER_ID', ocrFolder.getId(), 'Temporary Google Docs created for OCR');
  upsertSetting_(settingsSheet, 'MAX_UPLOAD_MB', String(PAYMENT_CENTER.DEFAULT_MAX_UPLOAD_MB), 'Maximum optimized screenshot size');
  upsertSetting_(settingsSheet, 'DEFAULT_STATUS', PAYMENT_CENTER.DEFAULT_STATUS, 'Status assigned to new submissions');

  DEFAULT_PAYMENT_METHODS.forEach(method => upsertPaymentMethod_(methodsSheet, method));

  formatPaymentCenterSheets_(settingsSheet, methodsSheet, paymentsSheet);
  SpreadsheetApp.flush();

  console.log('Payment Center setup completed. Spreadsheet ID: %s', spreadsheet.getId());
  console.log('Screenshot folder: %s', screenshotFolder.getUrl());
  console.log('OCR folder: %s', ocrFolder.getUrl());

  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    screenshotFolderId: screenshotFolder.getId(),
    ocrFolderId: ocrFolder.getId()
  };

}

/**
 * Run this function when the Payment Methods sheet already exists and you
 * only want to add/update the default TechGeekPH receiving accounts.
 */
function syncDefaultPaymentMethods() {
  const spreadsheet = getSpreadsheet_();
  const methodsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.METHODS_SHEET, PAYMENT_CENTER.METHOD_HEADERS);
  DEFAULT_PAYMENT_METHODS.forEach(method => upsertPaymentMethod_(methodsSheet, method));
  formatPaymentCenterSheets_(
    spreadsheet.getSheetByName(PAYMENT_CENTER.SETTINGS_SHEET),
    methodsSheet,
    spreadsheet.getSheetByName(PAYMENT_CENTER.PAYMENTS_SHEET)
  );
  SpreadsheetApp.flush();
  return { ok: true, paymentMethodsAddedOrUpdated: DEFAULT_PAYMENT_METHODS.length };
}


/**
 * One-click fix for existing installations that do not yet show Mari Bank.
 * Run this once from the Apps Script editor, then redeploy the Web App.
 */
function addMariBank() {
  const mariBank = DEFAULT_PAYMENT_METHODS.find(method => method.id === 'MARIBANK-001');
  if (!mariBank) throw new Error('Mari Bank default configuration is missing.');

  const spreadsheet = getSpreadsheet_();
  const methodsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.METHODS_SHEET, PAYMENT_CENTER.METHOD_HEADERS);
  upsertPaymentMethod_(methodsSheet, mariBank);
  SpreadsheetApp.flush();

  return {
    ok: true,
    id: mariBank.id,
    label: mariBank.label,
    accountNumber: mariBank.accountNumber,
    accountName: mariBank.accountName
  };
}

/**
 * Adds only default payment methods that are absent from the sheet.
 * Existing rows and any administrator changes are preserved.
 */
function ensureMissingDefaultPaymentMethods_() {
  const spreadsheet = getSpreadsheet_();
  const methodsSheet = ensureSheet_(spreadsheet, PAYMENT_CENTER.METHODS_SHEET, PAYMENT_CENTER.METHOD_HEADERS);
  const lastRow = methodsSheet.getLastRow();
  const existingIds = new Set(
    lastRow > 1
      ? methodsSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat().map(value => String(value).trim())
      : []
  );

  let added = 0;
  DEFAULT_PAYMENT_METHODS.forEach(method => {
    if (!existingIds.has(method.id)) {
      upsertPaymentMethod_(methodsSheet, method);
      existingIds.add(method.id);
      added += 1;
    }
  });

  if (added) SpreadsheetApp.flush();
  return added;
}

/**
 * GET endpoint.
 * Supported actions: health, getPaymentMethods
 */
function doGet(e) {
  try {
    const action = cleanText_(e && e.parameter ? e.parameter.action : '', 50) || 'health';

    if (action === 'health') {
      return jsonOutput_({
        ok: true,
        service: 'TechGeekPH Payment Center API',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getPaymentMethods') {
      // Automatically add any default payment option that is missing from
      // the Payment Methods sheet. This keeps newly added banks visible even
      // when the sheet was created using an older version of the project.
      ensureMissingDefaultPaymentMethods_();
      return jsonOutput_({
        ok: true,
        paymentMethods: getActivePaymentMethods_()
      });
    }

    return jsonOutput_({ ok: false, message: 'Unknown API action: ' + action });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, message: safeErrorMessage_(error) });
  }
}

/**
 * POST endpoint.
 * Uses text/plain JSON from GitHub Pages to avoid a browser preflight request.
 */
function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = cleanText_(payload.action, 50);

    if (action !== 'submitPayment') {
      return jsonOutput_({ ok: false, message: 'Unknown API action: ' + action });
    }

    const result = submitPayment_(payload);
    return jsonOutput_(result);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonOutput_({ ok: false, message: safeErrorMessage_(error) });
  }
}

/**
 * Useful after deployment. Run from the editor to verify setup and OCR service access.
 */
function testPaymentCenterSetup() {
  const spreadsheet = getSpreadsheet_();
  const methods = getActivePaymentMethods_();
  const settings = getSettingsMap_();

  const result = {
    ok: true,
    spreadsheetName: spreadsheet.getName(),
    activePaymentMethods: methods.length,
    screenshotFolderId: settings.SCREENSHOT_FOLDER_ID || '',
    ocrFolderId: settings.OCR_TEMP_FOLDER_ID || '',
    advancedDriveServiceDetected: typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.create === 'function'
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function submitPayment_(payload) {
  validateAntiSpam_(payload);

  const clientAccountNumber = cleanText_(payload.clientAccountNumber, 40);
  const clientName = cleanText_(payload.clientName, 100);
  const contactNumber = cleanText_(payload.contactNumber, 20);
  const paymentMethodId = cleanText_(payload.paymentMethodId, 60);
  const paymentDate = cleanText_(payload.paymentDate, 10);
  const submittedReference = cleanText_(payload.referenceNumber, 60);
  const notes = cleanText_(payload.notes, 500);
  const pageUrl = cleanText_(payload.pageUrl, 500);
  const userAgent = cleanText_(payload.userAgent, 500);
  const clientSubmittedAt = cleanText_(payload.submittedAtClient, 60);
  const amount = Number(payload.amount);

  if (!clientAccountNumber) throw new Error('TechGeekPH account number is required.');
  if (!clientName) throw new Error('Subscriber or client name is required.');
  if (!contactNumber) throw new Error('Contact number is required.');
  if (!paymentMethodId) throw new Error('Payment method is required.');
  if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('A valid payment date is required.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new Error('Enter a valid payment amount.');

  const method = findPaymentMethodById_(paymentMethodId);
  if (!method) throw new Error('The selected payment method is no longer active. Refresh the page and select another option.');

  const screenshot = decodeScreenshot_(payload.screenshotDataUrl, payload.screenshotFileName, payload.screenshotMimeType);
  const paymentId = nextPaymentId_();
  const settings = getSettingsMap_();
  const status = cleanText_(settings.DEFAULT_STATUS, 60) || PAYMENT_CENTER.DEFAULT_STATUS;

  const savedFile = saveScreenshot_(paymentId, clientAccountNumber, clientName, screenshot, settings);
  const ocrResult = extractOcrText_(savedFile.file, paymentId, settings);
  const parsed = parseOcrPaymentDetails_(ocrResult.text);

  const detectedReference = submittedReference || parsed.referenceNumber || '';
  const paymentsSheet = getSpreadsheet_().getSheetByName(PAYMENT_CENTER.PAYMENTS_SHEET);
  if (!paymentsSheet) throw new Error('Payments sheet is missing. Run setupPaymentCenter() again.');

  const now = new Date();
  const row = [
    now,
    paymentId,
    status,
    clientAccountNumber,
    clientName,
    contactNumber,
    method.id,
    method.label,
    method.accountName,
    method.accountNumber,
    amount,
    paymentDate,
    submittedReference,
    parsed.referenceNumber || '',
    parsed.amount || '',
    savedFile.url,
    savedFile.id,
    savedFile.name,
    ocrResult.status,
    ocrResult.text,
    notes,
    pageUrl,
    userAgent,
    clientSubmittedAt,
    '',
    '',
    '',
    now
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    paymentsSheet.appendRow(row);
    const rowNumber = paymentsSheet.getLastRow();
    paymentsSheet.getRange(rowNumber, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    paymentsSheet.getRange(rowNumber, 11).setNumberFormat('₱#,##0.00');
    paymentsSheet.getRange(rowNumber, 15).setNumberFormat('₱#,##0.00');
    paymentsSheet.getRange(rowNumber, 20).setWrap(true);
    paymentsSheet.getRange(rowNumber, 28).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    paymentId: paymentId,
    status: status,
    ocrStatus: ocrResult.status,
    detectedReferenceNumber: detectedReference,
    detectedAmount: parsed.amount || '',
    screenshotStored: true
  };
}

function getActivePaymentMethods_() {
  const sheet = getSpreadsheet_().getSheetByName(PAYMENT_CENTER.METHODS_SHEET);
  if (!sheet) throw new Error('Payment Methods sheet is missing. Run setupPaymentCenter() first.');
  if (sheet.getLastRow() <= 1) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, PAYMENT_CENTER.METHOD_HEADERS.length).getValues();
  return values
    .map(row => ({
      id: cleanText_(row[0], 60),
      label: cleanText_(row[1], 100),
      accountName: cleanText_(row[2], 100),
      accountNumber: cleanText_(row[3], 100),
      qrImageUrl: cleanText_(row[4], 500),
      active: normalizeBoolean_(row[5]),
      sortOrder: Number(row[6]) || 9999,
      notes: cleanText_(row[7], 300)
    }))
    .filter(item => item.active && item.id && item.label)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map(item => ({
      id: item.id,
      label: item.label,
      accountName: item.accountName,
      accountNumber: item.accountNumber,
      qrImageUrl: item.qrImageUrl,
      notes: item.notes
    }));
}

function findPaymentMethodById_(methodId) {
  return getActivePaymentMethods_().find(item => item.id === methodId) || null;
}

function decodeScreenshot_(dataUrl, originalName, declaredMimeType) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('A valid payment screenshot is required.');

  const mimeType = match[1].toLowerCase();
  if (PAYMENT_CENTER.ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error('Only PNG, JPG, and WEBP screenshots are allowed.');
  }

  if (declaredMimeType && cleanText_(declaredMimeType, 50).toLowerCase() !== mimeType) {
    throw new Error('Screenshot file type mismatch.');
  }

  const bytes = Utilities.base64Decode(match[2].replace(/\s/g, ''));
  const settings = getSettingsMap_();
  const maxUploadMb = Math.max(1, Number(settings.MAX_UPLOAD_MB) || PAYMENT_CENTER.DEFAULT_MAX_UPLOAD_MB);
  const maxBytes = maxUploadMb * 1024 * 1024;
  if (!bytes.length || bytes.length > maxBytes) {
    throw new Error('The screenshot must be smaller than ' + maxUploadMb + ' MB after optimization.');
  }

  const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  let name = safeFileName_(originalName || 'payment-screenshot' + extension);
  if (!/\.(png|jpe?g|webp)$/i.test(name)) name += extension;

  return {
    bytes: bytes,
    mimeType: mimeType,
    originalName: name,
    sizeBytes: bytes.length
  };
}

function saveScreenshot_(paymentId, clientAccountNumber, clientName, screenshot, settings) {
  const folderId = cleanText_(settings.SCREENSHOT_FOLDER_ID, 120);
  if (!folderId) throw new Error('Screenshot folder is not configured. Run setupPaymentCenter() again.');

  const folder = DriveApp.getFolderById(folderId);
  const extension = screenshot.mimeType === 'image/png' ? '.png' : screenshot.mimeType === 'image/webp' ? '.webp' : '.jpg';
  const fileName = [
    paymentId,
    safeFileName_(clientAccountNumber),
    safeFileName_(clientName)
  ].filter(Boolean).join('_').slice(0, 170) + extension;

  const blob = Utilities.newBlob(screenshot.bytes, screenshot.mimeType, fileName);
  const file = folder.createFile(blob);
  file.setDescription('Payment screenshot for ' + paymentId + ' · ' + clientAccountNumber + ' · ' + clientName);

  return {
    file: file,
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  };
}

/**
 * Converts the image to a temporary Google Doc. Drive automatically performs OCR
 * when an image is imported as a Google Docs file.
 * Requires the Advanced Drive Service (v3) enabled in appsscript.json.
 */
function extractOcrText_(imageFile, paymentId, settings) {
  let ocrDocId = '';
  try {
    if (typeof Drive === 'undefined' || !Drive.Files || typeof Drive.Files.create !== 'function') {
      throw new Error('Advanced Drive Service is not enabled.');
    }

    const metadata = {
      name: 'OCR_' + paymentId,
      mimeType: 'application/vnd.google-apps.document'
    };

    const ocrFolderId = cleanText_(settings.OCR_TEMP_FOLDER_ID, 120);
    if (ocrFolderId) metadata.parents = [ocrFolderId];

    const created = Drive.Files.create(metadata, imageFile.getBlob(), {
      fields: 'id,name',
      ocrLanguage: 'en'
    });
    ocrDocId = created.id;

    let text = '';
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        Utilities.sleep(attempt === 0 ? 700 : 1200);
        text = DocumentApp.openById(ocrDocId).getBody().getText().trim();
        if (text) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!text && lastError) throw lastError;
    return {
      status: text ? 'OCR completed' : 'OCR completed · no text detected',
      text: text
    };
  } catch (error) {
    console.warn('OCR failed for %s: %s', paymentId, safeErrorMessage_(error));
    return {
      status: 'OCR unavailable · ' + safeErrorMessage_(error),
      text: ''
    };
  } finally {
    if (ocrDocId) {
      try {
        DriveApp.getFileById(ocrDocId).setTrashed(true);
      } catch (cleanupError) {
        console.warn('Could not trash temporary OCR document: %s', cleanupError.message);
      }
    }
  }
}

function parseOcrPaymentDetails_(text) {
  const value = String(text || '').replace(/\u00a0/g, ' ');
  if (!value) return { referenceNumber: '', amount: '' };

  const referencePatterns = [
    /(?:reference|ref|transaction|trace)\s*(?:number|no\.?|id|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,39})/i,
    /(?:receipt|confirmation)\s*(?:number|no\.?|id|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,39})/i,
    /\b([0-9]{10,30})\b/
  ];

  let referenceNumber = '';
  for (let i = 0; i < referencePatterns.length; i++) {
    const match = value.match(referencePatterns[i]);
    if (match && match[1]) {
      referenceNumber = match[1].replace(/[^A-Z0-9-]/gi, '').slice(0, 60);
      if (referenceNumber) break;
    }
  }

  const amountPatterns = [
    /(?:amount\s*(?:paid|sent|received)?|total)\s*[:\-]?\s*(?:PHP|P|₱)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    /(?:PHP|₱)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    /\bP\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/i
  ];

  let amount = '';
  for (let i = 0; i < amountPatterns.length; i++) {
    const match = value.match(amountPatterns[i]);
    if (match && match[1]) {
      const number = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(number) && number > 0 && number <= 10000000) {
        amount = number;
        break;
      }
    }
  }

  return { referenceNumber: referenceNumber, amount: amount };
}

function nextPaymentId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const datePart = Utilities.formatDate(new Date(), PAYMENT_CENTER.TIME_ZONE, 'yyyyMMdd');
    const key = 'PAYMENT_SEQUENCE_' + datePart;
    const next = (Number(properties.getProperty(key)) || 0) + 1;
    properties.setProperty(key, String(next));
    return 'PAY-' + datePart + '-' + String(next).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!raw) throw new Error('The request body is empty.');

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid payload.');
    return parsed;
  } catch (error) {
    throw new Error('The request body is not valid JSON.');
  }
}

function validateAntiSpam_(payload) {
  if (cleanText_(payload.website, 120)) throw new Error('Submission rejected.');

  const startedAt = Number(payload.formStartedAt);
  if (Number.isFinite(startedAt)) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= 0 && elapsed < 1500) throw new Error('Please review the form before submitting.');
  }
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('PAYMENT_CENTER_SPREADSHEET_ID');
  if (!id) throw new Error('Payment Center is not initialized. Run setupPaymentCenter() first.');
  return SpreadsheetApp.openById(id);
}

function getSettingsMap_() {
  const sheet = getSpreadsheet_().getSheetByName(PAYMENT_CENTER.SETTINGS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return {};

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  return values.reduce((map, row) => {
    const key = cleanText_(row[0], 100);
    if (key) map[key] = cleanText_(row[1], 1000);
    return map;
  }, {});
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const needsHeaders = headers.some((header, index) => existingHeaders[index] !== header);
  if (needsHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function upsertSetting_(sheet, key, value, description) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = keys.findIndex(item => String(item).trim() === key);
    if (index >= 0) {
      sheet.getRange(index + 2, 2, 1, 2).setValues([[value, description]]);
      return;
    }
  }
  sheet.appendRow([key, value, description]);
}


function upsertPaymentMethod_(sheet, method) {
  const now = new Date();
  const lastRow = sheet.getLastRow();
  let rowNumber = 0;

  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = ids.findIndex(item => String(item).trim() === method.id);
    if (index >= 0) rowNumber = index + 2;
  }

  if (rowNumber) {
    const createdAt = sheet.getRange(rowNumber, 9).getValue() || now;
    sheet.getRange(rowNumber, 1, 1, PAYMENT_CENTER.METHOD_HEADERS.length).setValues([[
      method.id,
      method.label,
      method.accountName,
      method.accountNumber,
      method.qrImageUrl,
      method.active,
      method.sortOrder,
      method.notes,
      createdAt,
      now
    ]]);
    return;
  }

  sheet.appendRow([
    method.id,
    method.label,
    method.accountName,
    method.accountNumber,
    method.qrImageUrl,
    method.active,
    method.sortOrder,
    method.notes,
    now,
    now
  ]);
}
function formatPaymentCenterSheets_(settingsSheet, methodsSheet, paymentsSheet) {
  [settingsSheet, methodsSheet, paymentsSheet].forEach(sheet => {
    const lastColumn = sheet.getLastColumn();
    sheet.getRange(1, 1, 1, lastColumn)
      .setBackground('#0d3b66')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.getDataRange().setVerticalAlignment('middle');
  });

  settingsSheet.setColumnWidth(1, 210);
  settingsSheet.setColumnWidth(2, 330);
  settingsSheet.setColumnWidth(3, 420);

  methodsSheet.setColumnWidth(1, 120);
  methodsSheet.setColumnWidth(2, 190);
  methodsSheet.setColumnWidth(3, 190);
  methodsSheet.setColumnWidth(4, 160);
  methodsSheet.setColumnWidth(5, 320);
  methodsSheet.setColumnWidth(6, 90);
  methodsSheet.setColumnWidth(7, 90);
  methodsSheet.setColumnWidth(8, 360);
  methodsSheet.getRange('F2:F').setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build()
  );

  paymentsSheet.setColumnWidths(1, PAYMENT_CENTER.PAYMENT_HEADERS.length, 145);
  paymentsSheet.setColumnWidth(5, 190);
  paymentsSheet.setColumnWidth(16, 320);
  paymentsSheet.setColumnWidth(20, 520);
  paymentsSheet.setColumnWidth(21, 320);
  paymentsSheet.setColumnWidth(22, 320);
  paymentsSheet.setColumnWidth(23, 320);
  paymentsSheet.setColumnWidth(27, 320);
  paymentsSheet.getRange('K2:K').setNumberFormat('₱#,##0.00');
  paymentsSheet.getRange('O2:O').setNumberFormat('₱#,##0.00');
  paymentsSheet.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  paymentsSheet.getRange('Z2:Z').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  paymentsSheet.getRange('AB2:AB').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  paymentsSheet.getRange('T2:T').setWrap(true);
  paymentsSheet.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending Verification', 'Verified', 'Rejected', 'Needs Review'], true)
      .setAllowInvalid(true)
      .build()
  );

  const filterRange = paymentsSheet.getRange(1, 1, Math.max(2, paymentsSheet.getMaxRows()), PAYMENT_CENTER.PAYMENT_HEADERS.length);
  if (!paymentsSheet.getFilter()) filterRange.createFilter();
}

function getOrCreateFolderByName_(name) {
  const iterator = DriveApp.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : DriveApp.createFolder(name);
}

function normalizeBoolean_(value) {
  if (value === true || value === 1) return true;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'active'].indexOf(text) !== -1;
}

function safeFileName_(value) {
  const cleaned = String(value == null ? '' : value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90);
  return cleaned || 'file';
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength || 500);
}

function safeErrorMessage_(error) {
  const message = error && error.message ? error.message : String(error || 'Unknown error');
  return cleanText_(message, 500) || 'An unexpected error occurred.';
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
