# Google Sheet + Apps Script Setup

## Step 1 — Create the Google Sheet

1. Open Google Sheets.
2. Create a blank spreadsheet.
3. Rename it to **TechGeekPH Payment Center Records**.
4. Open **Extensions > Apps Script**.

## Step 2 — Add the backend code

1. Open the default `Code.gs` file.
2. Delete its contents.
3. Copy everything from this folder's `Code.gs` into the editor.
4. Open **Project Settings** in Apps Script.
5. Enable **Show "appsscript.json" manifest file in editor**.
6. Open `appsscript.json` and replace it with the supplied manifest.
7. Save the project.

The manifest enables the Advanced Drive Service v3 used for screenshot OCR.

## Step 3 — Run the automatic setup

1. From the function list, choose `setupPaymentCenter`.
2. Click **Run**.
3. Approve the requested Google Sheets, Drive, and Docs permissions.
4. Wait for **Execution completed**.

The setup creates:

- `Settings` sheet
- `Payment Methods` sheet
- `Payments` sheet
- Private Drive folder for screenshots
- Temporary Drive folder for OCR documents
- Seven supplied receiving accounts: GoTyme, BPI, UnionBank, Mari Bank, and three GCash options

## Step 4 — Test the setup

1. Choose `testPaymentCenterSetup`.
2. Click **Run**.
3. Open **Execution log**.
4. Confirm:
   - `activePaymentMethods` is `7`
   - `advancedDriveServiceDetected` is `true`

If the Drive service is not detected:

1. Open **Services +** in the Apps Script left sidebar.
2. Select **Drive API**.
3. Choose version `v3` and click **Add**.
4. Run the test again.

## Step 5 — Deploy as a Web App

1. Click **Deploy > New deployment**.
2. Click the gear icon and choose **Web app**.
3. Description: `TechGeekPH Payment Center API`.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Click **Deploy**.
7. Approve access if asked.
8. Copy the Web App URL ending in `/exec`.

Do not use the `/dev` test URL in the public GitHub website.

## Step 6 — Add the URL to GitHub

Open `config.js` and replace:

```javascript
apiUrl: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"
```

Example format:

```javascript
apiUrl: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec"
```

Commit the updated file to GitHub.

## Step 7 — Test a real submission

1. Open the GitHub Pages payment center.
2. Fill out the form.
3. Upload a clear payment screenshot.
4. Submit it.
5. Open the `Payments` sheet.
6. Confirm the row contains:
   - Payment ID
   - Client details
   - Amount
   - Screenshot URL
   - OCR Status
   - OCR Text

## Updating the Apps Script later

After changing `Code.gs`:

1. Click **Deploy > Manage deployments**.
2. Open the existing deployment.
3. Click **Edit**.
4. Choose **New version**.
5. Click **Deploy**.

The `/exec` URL normally remains the same when updating the existing deployment.


## Updating an existing Payment Center sheet

After replacing `Code.gs`, run `syncDefaultPaymentMethods()` once. This adds or updates the seven configured payment methods by ID and prevents duplicate rows.
