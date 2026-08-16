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
 * - Restores GCash Option #1 as a separate payment choice.
 * - Removes the old on-page payment verification form.
 * - Sends customers back to Messenger to submit a screenshot/reference.
 * - Improves readability and guidance for seniors and less technical users.
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
    notes: "I-scan ang QR o gamitin ang GCash number na nakalagay sa ibaba."
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

  function injectSeniorFriendlyStyles() {
    if (document.getElementById("tgSeniorFriendlyStyles")) return;

    const style = document.createElement("style");
    style.id = "tgSeniorFriendlyStyles";
    style.textContent = `
      /* Senior-friendly readability and tap targets */
      body {
        font-size: 17px !important;
        line-height: 1.65 !important;
      }

      .hero h1 {
        font-size: clamp(36px, 5.2vw, 60px) !important;
        line-height: 1.08 !important;
      }

      .hero p {
        max-width: 820px !important;
        font-size: clamp(17px, 2vw, 20px) !important;
        line-height: 1.6 !important;
      }

      .eyebrow,
      .only-channel-note,
      .status-pill {
        font-size: 14px !important;
      }

      .hero-steps {
        gap: 14px !important;
      }

      .step {
        min-height: 82px !important;
        padding: 15px 16px !important;
      }

      .step-number {
        width: 42px !important;
        height: 42px !important;
        flex-basis: 42px !important;
        font-size: 16px !important;
      }

      .step strong {
        font-size: 16px !important;
        line-height: 1.3 !important;
      }

      .step span:not(.step-number) {
        margin-top: 3px !important;
        font-size: 14px !important;
        line-height: 1.45 !important;
      }

      .section-heading h2 {
        font-size: clamp(28px, 3.5vw, 38px) !important;
      }

      .section-heading p,
      .picker-help {
        font-size: 16px !important;
        line-height: 1.55 !important;
      }

      .picker-field label {
        font-size: 15px !important;
      }

      .method-picker-select {
        min-height: 58px !important;
        font-size: 17px !important;
      }

      .channel-option {
        min-height: 94px !important;
        padding: 14px !important;
      }

      .channel-option-icon {
        width: 50px !important;
        height: 50px !important;
        font-size: 15px !important;
      }

      .channel-option-copy strong {
        font-size: 15px !important;
        line-height: 1.35 !important;
      }

      .channel-option-copy small {
        margin-top: 5px !important;
        font-size: 13px !important;
        line-height: 1.35 !important;
      }

      .selected-method-name {
        font-size: 23px !important;
      }

      .selected-method-tag {
        font-size: 13px !important;
      }

      .selected-method-details h3 {
        font-size: clamp(24px, 3vw, 32px) !important;
        line-height: 1.25 !important;
      }

      .selected-method-details > p,
      .method-notes {
        font-size: 16px !important;
        line-height: 1.6 !important;
      }

      .detail-row {
        min-height: 64px !important;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
      }

      .detail-label {
        font-size: 14px !important;
      }

      .detail-value {
        font-size: 18px !important;
        line-height: 1.4 !important;
      }

      .icon-btn {
        min-width: 46px !important;
        min-height: 46px !important;
        font-size: 18px !important;
      }

      .security-item strong {
        font-size: 15px !important;
      }

      .security-item span:not(.security-icon) {
        font-size: 14px !important;
        line-height: 1.5 !important;
      }

      .tg-messenger-note {
        font-size: 16px !important;
        line-height: 1.65 !important;
        padding: 16px !important;
      }

      .continue-method-btn,
      .download-qr-btn {
        min-height: 56px !important;
        padding: 13px 18px !important;
        font-size: 16px !important;
        line-height: 1.35 !important;
        font-weight: 900 !important;
      }

      .empty-method-state {
        font-size: 16px !important;
        line-height: 1.55 !important;
      }

      @media (max-width: 720px) {
        body { font-size: 17px !important; }
        main { width: min(100% - 18px, 1220px) !important; }
        .hero { padding: 28px 20px !important; }
        .hero h1 { font-size: clamp(34px, 11vw, 48px) !important; }
        .hero p { font-size: 18px !important; }
        .step { min-height: 78px !important; }
        .channel-grid { grid-auto-columns: minmax(270px, 90%) !important; }
        .channel-option { min-height: 88px !important; }
        .selected-method-content { gap: 18px !important; }
        .selected-method-head { padding: 16px !important; }
        .continue-method-btn, .download-qr-btn {
          width: 100% !important;
          min-height: 60px !important;
          font-size: 17px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function updatePageCopy() {
    const heroTitle = document.querySelector(".hero-content h1");
    if (heroTitle) heroTitle.textContent = "Magbayad nang madali at ligtas.";

    const heroParagraph = document.querySelector(".hero-content > p");
    if (heroParagraph) {
      heroParagraph.textContent = "Pumili lamang ng payment channel sa ibaba. I-check ang pangalan at account number bago magbayad. Pagkatapos, ipadala ang screenshot o reference number sa TechGeekPH Messenger.";
    }

    const channelNote = document.querySelector(".only-channel-note");
    if (channelNote) channelNote.textContent = "Online ang Payment Center · 8 official payment channels";

    const steps = document.querySelectorAll(".hero-steps .step");
    if (steps.length >= 3) {
      const step1Title = steps[0].querySelector("strong");
      const step1Text = steps[0].querySelector("span:not(.step-number)");
      const step2Title = steps[1].querySelector("strong");
      const step2Text = steps[1].querySelector("span:not(.step-number)");
      const step3Title = steps[2].querySelector("strong");
      const step3Text = steps[2].querySelector("span:not(.step-number)");

      if (step1Title) step1Title.textContent = "Piliin ang payment channel";
      if (step1Text) step1Text.textContent = "Pindutin ang GCash o bank na gusto ninyong gamitin.";
      if (step2Title) step2Title.textContent = "I-check muna bago magbayad";
      if (step2Text) step2Text.textContent = "Tingnan nang mabuti ang account name, number, o QR.";
      if (step3Title) step3Title.textContent = "Ipadala ang proof of payment";
      if (step3Text) step3Text.textContent = "I-send ang screenshot o reference number sa Messenger.";
    }

    const paymentSection = document.getElementById("paymentOptionsSection");
    if (paymentSection) {
      const title = paymentSection.querySelector(".section-heading h2");
      const description = paymentSection.querySelector(".section-heading p");
      if (title) title.textContent = "Piliin kung saan kayo magbabayad";
      if (description) description.textContent = "Pindutin lamang ang inyong preferred GCash o bank. Lalabas agad ang official QR at account details.";
    }

    const pickerLabel = document.querySelector(".picker-field label");
    if (pickerLabel) pickerLabel.textContent = "Payment channel";

    const pickerHelp = document.querySelector(".picker-help");
    if (pickerHelp) pickerHelp.textContent = "Tip: Kung GCash ang gamit ninyo, piliin ang GCash option na gusto ninyo at i-scan ang QR.";

    const emptyState = document.getElementById("emptyMethodState");
    if (emptyState && !emptyState.hidden) {
      emptyState.innerHTML = '<span class="empty-method-icon">⌄</span><span>Pumili muna ng payment channel para makita ang QR at account details.</span>';
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
        <div class="selected-method-tag">Official</div>
      </div>
      <div class="selected-method-content">
        <div class="selected-qr-wrap">
          <img src="${escapeHtml(GCASH_OPTION_1.qrImageUrl)}" alt="${escapeHtml(GCASH_OPTION_1.label)} QR code">
          <a class="download-qr-btn" href="${escapeHtml(GCASH_OPTION_1.qrImageUrl)}" download="TechGeekPH-GCash-Option-1.png">I-save ang QR Code</a>
        </div>
        <div class="selected-method-details">
          <h3 style="margin:0;color:var(--brand-dark);font-size:clamp(24px,3vw,32px);line-height:1.25;letter-spacing:-.4px">Bago magbayad, i-check muna ang details.</h3>
          <p style="margin:10px 0 16px;color:var(--muted);font-size:16px;line-height:1.6">I-scan ang QR o gamitin ang GCash number sa ibaba. Siguraduhing tama ang recipient bago pindutin ang Send.</p>
          <div class="detail-row">
            <span class="detail-label">Account name</span>
            <span class="detail-value">${escapeHtml(GCASH_OPTION_1.accountName)}</span>
            <button class="icon-btn" type="button" data-tg-copy="${escapeHtml(GCASH_OPTION_1.accountName)}" aria-label="Copy account name">⧉</button>
          </div>
          <div class="detail-row">
            <span class="detail-label">GCash number</span>
            <span class="detail-value">${escapeHtml(GCASH_OPTION_1.accountNumber)}</span>
            <button class="icon-btn" type="button" data-tg-copy="${escapeHtml(GCASH_OPTION_1.accountNumber)}" aria-label="Copy GCash number">⧉</button>
          </div>
          <p class="method-notes">${escapeHtml(GCASH_OPTION_1.notes)}</p>
          <div class="tg-messenger-note" style="margin:16px 0;padding:16px;border:1px solid rgba(53,167,255,.34);border-radius:14px;background:rgba(8,119,232,.10);color:var(--future-text,#ecf8ff);font-size:16px;line-height:1.65">
            <strong>✅ Pagkatapos magbayad:</strong><br>
            Pindutin ang button sa ibaba at ipadala sa Messenger ang <strong>screenshot ng payment</strong> o ang <strong>reference number</strong>.
          </div>
          <button class="continue-method-btn" id="continueMethodButton" data-tg-custom="1" data-tg-messenger-patched="1" type="button">BAYAD NA AKO — IPADALA SA MESSENGER</button>
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
      button.setAttribute("aria-label", "Piliin ang " + GCASH_OPTION_1.label);
      setTheme(button);
      button.innerHTML = `
        <span class="channel-option-icon">G</span>
        <span class="channel-option-copy"><strong>${escapeHtml(GCASH_OPTION_1.label)}</strong><small>GCash •••• ${GCASH_OPTION_1.accountNumber.slice(-4)}</small></span>
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

    const title = card.querySelector(".selected-method-details h3");
    if (title) title.textContent = "Bago magbayad, i-check muna ang details.";

    const intro = card.querySelector(".selected-method-details > p");
    if (intro) intro.textContent = "I-scan ang QR o gamitin ang account number sa ibaba. Siguraduhing tama ang recipient bago magbayad.";

    const button = card.querySelector("#continueMethodButton");
    if (!button || button.dataset.tgMessengerPatched === "1") return;

    button.dataset.tgMessengerPatched = "1";
    button.textContent = "BAYAD NA AKO — IPADALA SA MESSENGER";

    const securityItems = card.querySelectorAll(".security-item");
    if (securityItems.length >= 1) {
      const strong = securityItems[0].querySelector("strong");
      const span = securityItems[0].querySelector("span:not(.security-icon)");
      if (strong) strong.textContent = "I-check ang recipient";
      if (span) span.textContent = "Siguraduhing tugma ang pangalan at account number bago magbayad.";
    }
    if (securityItems.length >= 2) {
      const strong = securityItems[1].querySelector("strong");
      const span = securityItems[1].querySelector("span:not(.security-icon)");
      if (strong) strong.textContent = "I-check ang halaga";
      if (span) span.textContent = "Siguraduhing tama ang amount bago pindutin ang Send o Pay.";
    }
    if (securityItems.length >= 3) {
      const strong = securityItems[2].querySelector("strong");
      const span = securityItems[2].querySelector("span:not(.security-icon)");
      if (strong) strong.textContent = "I-save ang resibo";
      if (span) span.textContent = "Kumuha ng screenshot o itabi ang reference number pagkatapos magbayad.";
    }

    if (!card.querySelector(".tg-messenger-note")) {
      const note = document.createElement("div");
      note.className = "tg-messenger-note";
      note.style.cssText = "margin:16px 0;padding:16px;border:1px solid rgba(53,167,255,.34);border-radius:14px;background:rgba(8,119,232,.10);color:var(--future-text,#ecf8ff);font-size:16px;line-height:1.65";
      note.innerHTML = "<strong>✅ Pagkatapos magbayad:</strong><br>Pindutin ang button sa ibaba at ipadala sa Messenger ang <strong>screenshot ng payment</strong> o ang <strong>reference number</strong>.";
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
    injectSeniorFriendlyStyles();
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
