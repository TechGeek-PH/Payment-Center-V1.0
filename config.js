window.PAYMENT_CENTER_CONFIG = Object.freeze({
  // Paste the deployed Google Apps Script Web App URL here.
  // Example: https://script.google.com/macros/s/AKfycb.../exec
  apiUrl: "https://script.google.com/macros/s/AKfycbyJnq1A7RfHbjD_lKYoJUw_iT_CInD83G6snQSBHSxBEnP4JGPniPX4-bQQG9MXTHVOAQ/exec",

  businessName: "TechGeekPH Solutions & Services Inc.",
  branchName: "Sta. Ana Branch",
  supportContact: "0965 075 3950",
  currency: "PHP",
  maxUploadMb: 5,
  messengerUrl: "https://www.messenger.com/t/526246293907286",

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

/*
 * Payment Center front-end compatibility patch.
 *
 * The current index.html uses GCASH-001 for the GCash QR PH business QR.
 * This patch restores the original GCash Option #1 as an additional visible
 * payment choice without replacing the QR PH option. It also removes the
 * on-page payment verification form and sends customers back to Messenger
 * to submit either their payment screenshot or transaction reference number.
 */
(() => {
  "use strict";

  const MESSENGER_URL = "https://www.messenger.com/t/526246293907286";
  const GCASH_OPTION_1 = Object.freeze({
    id: "GCASH-DIRECT-001",
    label: "GCash Option #1",
    accountNumber: "09950466591",
    accountName: "Mark De Mesa",
    qrImageUrl: "assets/qr/gcash-option-1.png",
    notes: "Scan the QR code or send to the mobile number shown."
  });

  const setTheme = element => {
    if (!element) return;
    element.style.setProperty("--brand", "#0877E8");
    element.style.setProperty("--brand-dark", "#0754B8");
    element.style.setProperty("--brand-secondary", "#35A7FF");
    element.style.setProperty("--brand-soft", "#ECF6FF");
  };

  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const copyText = async value => {
    const text = String(value || "");
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
  };

  const openMessenger = () => {
    window.open(MESSENGER_URL, "_blank", "noopener,noreferrer");
  };

  function updatePageCopy() {
    const heroParagraph = document.querySelector(".hero-content > p");
    if (heroParagraph) {
      heroParagraph.textContent = "Choose an official bank, e-wallet, or QR PH channel, confirm the recipient, then send your payment screenshot or reference number through TechGeekPH Messenger.";
    }

    const channelNote = document.querySelector(".only-channel-note");
    if (channelNote) channelNote.textContent = "System online · 8 verified payment channels";

    const steps = document.querySelectorAll(".hero-steps .step");
    if (steps.length >= 3) {
      const title = steps[2].querySelector("strong");
      const text = steps[2].querySelector("span:not(.step-number)");
      if (title) title.textContent = "Send payment proof";
      if (text) text.textContent = "Send the screenshot or reference number through Messenger.";
    }

    const submitSection = document.getElementById("submitPaymentSection");
    if (submitSection) submitSection.remove();
  }

  function renderGcashOption1() {
    const card = document.getElementById("selectedMethodCard");
    const emptyState = document.getElementById("emptyMethodState");
    const pickerPanel = document.getElementById("methodPickerPanel");
    const picker = document.getElementById("methodPicker");
    const grid = document.getElementById("channelGrid");

    if (!card) return;

    setTheme(card);
    setTheme(pickerPanel);
    setTheme(picker);

    if (emptyState) emptyState.hidden = true;
    if (picker) picker.value = GCASH_OPTION_1.id;

    if (grid) {
      grid.querySelectorAll(".channel-option").forEach(button => {
        const selected = button.dataset.methodId === GCASH_OPTION_1.id;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    card.innerHTML = `
      <span id="tgGcashOption1CardMarker" hidden></span>
      <div class="selected-method-head">
        <div class="selected-method-name">${escapeHtml(GCASH_OPTION_1.label)}</div>
        <div class="selected-method-tag">Available</div>
      </div>
      <div class="selected-method-content">
        <div class="selected-qr-wrap">
          <img src="${escapeHtml(GCASH_OPTION_1.qrImageUrl)}" alt="${escapeHtml(GCASH_OPTION_1.label)} QR code">
          <a class="download-qr-btn" href="${escapeHtml(GCASH_OPTION_1.qrImageUrl)}" download="TechGeekPH-GCash-Option-1.png">Save QR code</a>
        </div>
        <div class="selected-method-details">
          <h3 style="margin:0;color:var(--brand-dark);font-size:clamp(22px,3vw,31px);line-height:1.12;letter-spacing:-.6px">Verify the details, then pay securely.</h3>
          <p style="margin:9px 0 14px;color:var(--muted);font-size:14px">Use GCash and always confirm the recipient details before sending your payment.</p>
          <div class="detail-row">
            <span class="detail-label">Account name</span>
            <span class="detail-value">${escapeHtml(GCASH_OPTION_1.accountName)}</span>
            <button class="icon-btn" type="button" data-tg-copy="${escapeHtml(GCASH_OPTION_1.accountName)}" aria-label="Copy account name">⧉</button>
          </div>
          <div class="detail-row">
            <span class="detail-label">Account no.</span>
            <span class="detail-value">${escapeHtml(GCASH_OPTION_1.accountNumber)}</span>
            <button class="icon-btn" type="button" data-tg-copy="${escapeHtml(GCASH_OPTION_1.accountNumber)}" aria-label="Copy account number">⧉</button>
          </div>
          <p class="method-notes">${escapeHtml(GCASH_OPTION_1.notes)}</p>
          <div class="tg-messenger-note" style="margin:16px 0;padding:14px;border:1px solid rgba(53,167,255,.28);border-radius:14px;background:rgba(8,119,232,.08);color:var(--future-text,#ecf8ff);font-size:13px;line-height:1.55">
            <strong>After payment:</strong> Bumalik po sa TechGeekPH Messenger at ipadala ang <strong>payment screenshot</strong> o <strong>reference number</strong> para ma-verify ang inyong payment.
          </div>
          <button class="continue-method-btn" id="continueMethodButton" data-tg-custom="1" data-tg-messenger-patched="1" type="button">I’ve paid — send screenshot / reference via Messenger</button>
        </div>
      </div>`;

    card.querySelectorAll("[data-tg-copy]").forEach(button => {
      button.addEventListener("click", () => copyText(button.dataset.tgCopy || ""));
    });

    card.hidden = false;
  }

  function ensureGcashOption1() {
    const grid = document.getElementById("channelGrid");
    const picker = document.getElementById("methodPicker");
    if (!grid || !picker) return;

    if (!picker.querySelector(`option[value="${GCASH_OPTION_1.id}"]`)) {
      const option = document.createElement("option");
      option.value = GCASH_OPTION_1.id;
      option.textContent = GCASH_OPTION_1.label;
      const qrPhOption = picker.querySelector('option[value="GCASH-001"]');
      if (qrPhOption && qrPhOption.nextSibling) {
        picker.insertBefore(option, qrPhOption.nextSibling);
      } else {
        picker.appendChild(option);
      }
    }

    if (!grid.querySelector(`[data-method-id="${GCASH_OPTION_1.id}"]`)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "channel-option";
      button.dataset.methodId = GCASH_OPTION_1.id;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Select " + GCASH_OPTION_1.label);
      setTheme(button);
      button.innerHTML = `
        <span class="channel-option-icon">G</span>
        <span class="channel-option-copy"><strong>${escapeHtml(GCASH_OPTION_1.label)}</strong><small>Account •••• ${GCASH_OPTION_1.accountNumber.slice(-4)}</small></span>
        <span class="channel-option-check" aria-hidden="true"></span>`;
      button.addEventListener("click", renderGcashOption1);

      const qrPhButton = grid.querySelector('[data-method-id="GCASH-001"]');
      if (qrPhButton && qrPhButton.nextSibling) {
        grid.insertBefore(button, qrPhButton.nextSibling);
      } else {
        grid.appendChild(button);
      }
    }
  }

  function updateSelectedMethodCard() {
    const card = document.getElementById("selectedMethodCard");
    if (!card || card.hidden || card.querySelector("#tgGcashOption1CardMarker")) return;

    const button = card.querySelector("#continueMethodButton");
    if (!button || button.dataset.tgMessengerPatched === "1") return;

    button.dataset.tgMessengerPatched = "1";
    button.textContent = "I’ve paid — send screenshot / reference via Messenger";

    const securityItems = card.querySelectorAll(".security-item");
    if (securityItems.length) {
      const last = securityItems[securityItems.length - 1];
      const strong = last.querySelector("strong");
      const span = last.querySelector("span:not(.security-icon)");
      if (strong) strong.textContent = "Send your payment proof";
      if (span) span.textContent = "After payment, send the screenshot or reference number through Messenger.";
    }

    if (!card.querySelector(".tg-messenger-note")) {
      const note = document.createElement("div");
      note.className = "tg-messenger-note";
      note.style.cssText = "margin:16px 0;padding:14px;border:1px solid rgba(53,167,255,.28);border-radius:14px;background:rgba(8,119,232,.08);color:var(--future-text,#ecf8ff);font-size:13px;line-height:1.55";
      note.innerHTML = "<strong>After payment:</strong> Bumalik po sa TechGeekPH Messenger at ipadala ang <strong>payment screenshot</strong> o <strong>reference number</strong> para ma-verify ang inyong payment.";
      button.parentNode.insertBefore(note, button);
    }
  }

  document.addEventListener("click", event => {
    const messengerButton = event.target.closest && event.target.closest("#continueMethodButton");
    if (!messengerButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMessenger();
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    updatePageCopy();
    ensureGcashOption1();
    updateSelectedMethodCard();

    const picker = document.getElementById("methodPicker");
    if (picker) {
      picker.addEventListener("change", event => {
        if (event.target.value !== GCASH_OPTION_1.id) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        renderGcashOption1();
      }, true);
    }

    const grid = document.getElementById("channelGrid");
    if (grid) {
      new MutationObserver(() => ensureGcashOption1()).observe(grid, { childList: true });
    }

    const selectedCard = document.getElementById("selectedMethodCard");
    if (selectedCard) {
      new MutationObserver(() => updateSelectedMethodCard()).observe(selectedCard, { childList: true, subtree: true });
    }
  });
})();
