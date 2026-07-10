# TechGeekPH Payment Center

Ready-to-publish GitHub Pages payment center connected to Google Sheets and Google Drive.

## Active payment accounts included

- **GoTyme Bank** — `019772179572` — Mark Corona De Mesa
- **BPI Bank** — `9869013474` — Mark De Mesa
- **UnionBank** — `109480124887` — Mark De Mesa
- **Mari Bank** — `11624449510` — Mark De Mesa
- **GCash Option #1** — `09950466591` — Mark De Mesa
- **GCash Option #2** — `09926020173` — Mark De Mesa
- **GCash Option #3** — `09937418007` — Kimberly Jill De Mesa

The repeated UnionBank entry supplied in the account list was included only once because the account number and account name were identical.


## Included features

- Uses a compact bank/e-wallet dropdown; the selected QR code and account details appear only after a client chooses an option.
- Uses the uploaded TechGeekPH logo, banner, and payment-channel image.
- Clients can enter their TechGeekPH account number, name, contact number, amount, payment date, reference number, and notes.
- Clients can upload a payment screenshot from a phone or computer.
- The screenshot is saved privately in Google Drive.
- Google Drive OCR reads the screenshot and records all extracted text in the **OCR Text** column of the Google Sheet.
- The backend also attempts to extract the payment reference number and amount.
- New records are marked **Pending Verification**.
- Mobile-responsive layout suitable for GitHub Pages.

## Project folders

```text
TechGeekPH-Payment-Center-MariBank/
├── index.html
├── config.js
├── .nojekyll
├── assets/
│   ├── banner/
│   │   └── Banner.png
│   ├── logo/
│   │   ├── TechGeekPH-logo.png
│   │   ├── TechGeekPH-logo-square.jpg
│   │   └── TechGeekPH-mark.png
│   ├── payment/
│   │   └── Payment-Method.png
│   └── qr/
│       ├── gotyme-bank.png
│       ├── bpi-bank.png
│       ├── union-bank.png
│       ├── gcash-option-1.png
│       ├── gcash-option-2.png
│       ├── gcash-option-3.png
│       └── mari-bank.png
└── apps-script/
    ├── Code.gs
    ├── appsscript.json
    └── SETUP_GUIDE.md
```

## Setup

1. Create or open the Google Sheet for payment records.
2. Open **Extensions → Apps Script**.
3. Replace `Code.gs` and `appsscript.json` with the files inside `apps-script/`.
4. Run `setupPaymentCenter()` once.
5. Deploy as a Web App using **Execute as Me** and **Anyone** access.
6. Paste the `/exec` deployment URL into `config.js`.
7. Upload the full project to GitHub and enable GitHub Pages from the `main` branch root.

### Existing Payment Center sheet

After replacing `Code.gs`, run:

```javascript
syncDefaultPaymentMethods()
```

This adds or updates the seven supplied accounts in the `Payment Methods` sheet without creating duplicate IDs.


## Security notes

- The screenshot folder is private by default.
- Do not place passwords, private keys, or Google credentials in `config.js` because GitHub Pages files are public.
- OCR can misread text, so billing staff should verify the original screenshot before marking a payment as verified.

## Mari Bank not showing on an older live deployment

The current package includes:

- Mari Bank
- Account No.: `11624449510`
- Account Name: `Mark De Mesa`
- QR image: `assets/qr/mari-bank.png`

For an existing installation, replace `apps-script/Code.gs`, run `addMariBank()` once, then deploy a **New version** of the Web App. The backend also automatically inserts missing default payment options whenever `getPaymentMethods` is requested.

## Mari Bank index fix

Mari Bank is now embedded directly in `index.html`:

- Account No.: `11624449510`
- Account Name: `Mark De Mesa`
- QR: `assets/qr/mari-bank.png`

The page merges the Google Sheet payment methods with the built-in list, so Mari Bank appears even before the Sheet is updated.

## QR Download

The selected payment account card now includes a **Download QR Code** button. It downloads the current bank or e-wallet QR image using the payment option name and account number as the file name.
