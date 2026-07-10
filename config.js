window.PAYMENT_CENTER_CONFIG = Object.freeze({
  // Paste the deployed Google Apps Script Web App URL here.
  // Example: https://script.google.com/macros/s/AKfycb.../exec
  apiUrl: "https://script.google.com/macros/s/AKfycbyJnq1A7RfHbjD_lKYoJUw_iT_CInD83G6snQSBHSxBEnP4JGPniPX4-bQQG9MXTHVOAQ/exec",

  businessName: "TechGeekPH Solutions & Services Inc.",
  branchName: "Sta. Ana Branch",
  supportContact: "0965 075 3950",
  currency: "PHP",
  maxUploadMb: 5,

  // Local fallback displayed while the Apps Script API is not configured
  // or when it is temporarily unavailable.
  fallbackPaymentMethods: [
    {
        "id": "GOTYME-001",
        "label": "GoTyme Bank",
        "accountNumber": "019772179572",
        "accountName": "Mark Corona De Mesa",
        "qrImageUrl": "assets/qr/gotyme-bank.png",
        "notes": "Scan the QR code or transfer using the account number shown."
    },
    {
        "id": "BPI-001",
        "label": "BPI Bank",
        "accountNumber": "9869013474",
        "accountName": "Mark De Mesa",
        "qrImageUrl": "assets/qr/bpi-bank.png",
        "notes": "Scan the QR code or transfer using the account number shown."
    },
    {
        "id": "UNIONBANK-001",
        "label": "UnionBank",
        "accountNumber": "109480124887",
        "accountName": "Mark De Mesa",
        "qrImageUrl": "assets/qr/union-bank.png",
        "notes": "Scan the QR code or transfer using the account number shown."
    },
    {
        "id": "MARIBANK-001",
        "label": "Mari Bank",
        "accountNumber": "11624449510",
        "accountName": "Mark De Mesa",
        "qrImageUrl": "assets/qr/mari-bank.png",
        "notes": "Scan the QR code or transfer using the account number shown."
    },
    {
        "id": "GCASH-001",
        "label": "GCash Option #1",
        "accountNumber": "09950466591",
        "accountName": "Mark De Mesa",
        "qrImageUrl": "assets/qr/gcash-option-1.png",
        "notes": "Scan the QR code or send to the mobile number shown."
    },
    {
        "id": "GCASH-002",
        "label": "GCash Option #2",
        "accountNumber": "09926020173",
        "accountName": "Mark De Mesa",
        "qrImageUrl": "assets/qr/gcash-option-2.png",
        "notes": "Scan the QR code or send to the mobile number shown."
    },
    {
        "id": "GCASH-003",
        "label": "GCash Option #3",
        "accountNumber": "09937418007",
        "accountName": "Kimberly Jill De Mesa",
        "qrImageUrl": "assets/qr/gcash-option-3.png",
        "notes": "Scan the QR code or send to the mobile number shown."
    }
]
});
