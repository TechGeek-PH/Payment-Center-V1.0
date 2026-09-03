(() => {
  'use strict';

  const config = window.PAYMENT_CENTER_CONFIG || {};
  const apiUrl = String(config.apiUrl || '').trim();
  const pageUrl = new URL(window.location.href);
  const state = {
    gateway: null,
    accountNo: '',
    phone: '',
    bill: null,
    selectedMethod: '',
    statusPoll: null
  };

  const METHOD_DETAILS = {
    gcash: {
      label: 'GCash',
      mark: 'GC',
      description: 'Secure GCash checkout at app authorization.'
    },
    qrph: {
      label: 'QR Ph',
      mark: 'QR',
      description: 'Pay using GCash, Maya, or a supported bank app.'
    },
    card: {
      label: 'Credit / Debit Card',
      mark: 'CC',
      description: 'Visa or Mastercard through secure checkout.'
    },
    paymaya: {
      label: 'Maya',
      mark: 'MY',
      description: 'Authorize payment using your Maya wallet.'
    },
    maya: {
      label: 'Maya',
      mark: 'MY',
      description: 'Authorize payment using your Maya wallet.'
    },
    grab_pay: {
      label: 'GrabPay',
      mark: 'GP',
      description: 'Authorize payment using your GrabPay wallet.'
    },
    shopeepay: {
      label: 'ShopeePay',
      mark: 'SP',
      description: 'Authorize payment using your ShopeePay wallet.'
    },
    dob: {
      label: 'Online Banking',
      mark: 'BNK',
      description: 'Pay through an available online bank.'
    },
    billease: {
      label: 'BillEase',
      mark: 'BL',
      description: 'Use BillEase when available for your account.'
    }
  };

  function start() {
    if (pageUrl.searchParams.get('manual') === '1') return;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(apiUrl)) return;
    loadGateway();
  }

  async function loadGateway() {
    try {
      const gateway = await apiGet('paymentGatewayStatus');
      if (!gateway || !gateway.ok || !gateway.configured) return;
      state.gateway = gateway;
      mountApp();
    } catch (error) {
      console.warn('Centralized checkout is unavailable; keeping manual payment options.', error);
    }
  }

  function mountApp() {
    const main = document.querySelector('main');
    if (!main) return;
    main.id = 'tgpmApp';
    main.innerHTML = '<div class="tgpm-shell" id="tgpmShell"></div>';

    const paymentResult = pageUrl.searchParams.get('payment');
    const reference = clean(pageUrl.searchParams.get('reference'), 80);
    const token = clean(pageUrl.searchParams.get('token'), 200);

    if (paymentResult === 'success' && reference && token) {
      renderCheckingStatus(reference, token);
      return;
    }
    if (paymentResult === 'cancelled') {
      renderCancelled(reference);
      return;
    }
    renderLookup();
  }

  function renderLookup() {
    stopPolling();
    state.accountNo = '';
    state.phone = '';
    state.bill = null;
    state.selectedMethod = '';

    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card" aria-labelledby="tgpmTitle">
        <div class="tgpm-card-head">
          <div class="tgpm-kicker">Online billing payment</div>
          <h1 id="tgpmTitle">Check and pay your bill</h1>
          <p>Verify your TechGeekPH account, review the exact Billing Ledger balance, then continue to PayMongo's secure checkout.</p>
          ${steps(1)}
        </div>
        <div class="tgpm-card-body">
          <form id="tgpmLookupForm" novalidate>
            <div class="tgpm-form-grid">
              <div class="tgpm-field">
                <label for="tgpmAccountNo">TechGeekPH account number</label>
                <input id="tgpmAccountNo" name="accountNo" type="text" maxlength="40" autocomplete="off" autocapitalize="characters" placeholder="Example: SATR0300" required>
                <small>Makikita ito sa billing notice o statement of account.</small>
              </div>
              <div class="tgpm-field">
                <label for="tgpmPhone">Registered mobile number</label>
                <input id="tgpmPhone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" pattern="09[0-9]{9}" placeholder="09XXXXXXXXX" required>
                <small>Ilagay ang kumpletong 11-digit number na naka-register sa account.</small>
              </div>
            </div>
            <div class="tgpm-actions">
              <button class="tgpm-button" id="tgpmLookupButton" type="submit">Check my bill</button>
              <a class="tgpm-link" href="${manualUrl()}">Use manual payment instead</a>
            </div>
            <div class="tgpm-alert" id="tgpmLookupError" role="alert"></div>
          </form>
          ${poweredBy()}
        </div>
      </section>
    `;

    const form = document.getElementById('tgpmLookupForm');
    const phoneInput = document.getElementById('tgpmPhone');
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    });
    form.addEventListener('submit', handleLookup);
  }

  async function handleLookup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const accountInput = document.getElementById('tgpmAccountNo');
    const phoneInput = document.getElementById('tgpmPhone');
    const button = document.getElementById('tgpmLookupButton');
    const errorBox = document.getElementById('tgpmLookupError');
    clearError(errorBox);

    const accountNo = clean(accountInput.value, 40).toUpperCase();
    const phone = String(phoneInput.value || '').replace(/\D/g, '');
    accountInput.value = accountNo;
    phoneInput.value = phone;

    if (!/^[A-Z0-9-]{4,40}$/.test(accountNo)) {
      showError(errorBox, 'Please enter a valid TechGeekPH account number.');
      accountInput.focus();
      return;
    }
    if (!/^09\d{9}$/.test(phone)) {
      showError(errorBox, 'Please enter the complete 11-digit registered mobile number.');
      phoneInput.focus();
      return;
    }

    setBusy(button, true, 'Checking Billing Ledger…');
    try {
      const data = await apiPost('lookupBillingAccount', { accountNo, phone });
      if (!data.ok) throw new Error(data.message || 'Unable to check this account.');
      state.accountNo = accountNo;
      state.phone = phone;
      state.bill = data;
      if (!data.hasBalance) renderNoBalance(data);
      else renderBill(data);
    } catch (error) {
      showError(errorBox, error.message || 'Unable to check this account. Please try again.');
    } finally {
      setBusy(button, false, 'Check my bill');
    }
  }

  function renderNoBalance(data) {
    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card" aria-labelledby="tgpmNoBalanceTitle">
        <div class="tgpm-card-head">
          <div class="tgpm-kicker">Billing Ledger checked</div>
          <h1 id="tgpmNoBalanceTitle">No outstanding balance</h1>
          <p>${escapeHtml(data.clientName || 'Client')} · ${escapeHtml(data.accountNo || state.accountNo)}</p>
          ${steps(3)}
        </div>
        <div class="tgpm-card-body">
          <div class="tgpm-empty">
            <strong>Your account is clear.</strong>
            <span>${escapeHtml(data.message || 'No unpaid bill was found.')}</span>
          </div>
          <div class="tgpm-actions">
            <button class="tgpm-button" id="tgpmCheckAnother" type="button">Check another account</button>
            <a class="tgpm-link" href="${manualUrl()}">View manual payment options</a>
          </div>
          ${poweredBy()}
        </div>
      </section>
    `;
    document.getElementById('tgpmCheckAnother').addEventListener('click', renderLookup);
  }

  function renderBill(data) {
    const methods = Array.isArray(data.paymentMethods) && data.paymentMethods.length
      ? data.paymentMethods
      : state.gateway.paymentMethods || [];
    state.selectedMethod = methods.includes('gcash') ? 'gcash' : methods[0] || '';

    const totalAmountDue = (data.bills || []).reduce((sum, bill) => sum + Number(bill.amountDue || 0), 0);
    const totalAmountPaid = (data.bills || []).reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0);
    const invoices = (data.bills || []).map(bill => `
      <div class="tgpm-invoice">
        <span>${escapeHtml(bill.billingPeriod || bill.billingId)}${bill.dueDate ? ' · Due ' + escapeHtml(bill.dueDate) : ''}</span>
        <strong>${money(bill.balance)}</strong>
      </div>
    `).join('');

    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card" aria-labelledby="tgpmBillTitle">
        <div class="tgpm-card-head">
          <div class="tgpm-kicker">Verified billing account</div>
          <h1 id="tgpmBillTitle">Review your balance</h1>
          <p>The amount below comes directly from the TechGeekPH Billing Ledger.</p>
          ${steps(2)}
        </div>
        <div class="tgpm-card-body">
          <div class="tgpm-bill-top">
            <div>
              <h2>${escapeHtml(data.clientName || 'TechGeekPH Client')}</h2>
              <p>${(data.bills || []).length} open billing record${(data.bills || []).length === 1 ? '' : 's'}</p>
            </div>
            <span class="tgpm-account-badge">${escapeHtml(data.accountNo || state.accountNo)}</span>
          </div>

          <div class="tgpm-amount-card" aria-label="Billing totals">
            <div class="tgpm-amount-item is-primary"><span>Total balance</span><strong>${money(data.totalBalance)}</strong></div>
            <div class="tgpm-amount-item"><span>Total billed</span><strong>${money(totalAmountDue)}</strong></div>
            <div class="tgpm-amount-item"><span>Previously paid</span><strong>${money(totalAmountPaid)}</strong></div>
          </div>

          <div class="tgpm-section-label">Billing details</div>
          <div class="tgpm-invoices">${invoices}</div>

          <div class="tgpm-section-label">Choose payment method</div>
          <div class="tgpm-methods" id="tgpmMethods" role="radiogroup" aria-label="Payment method">
            ${methods.map(methodButton).join('')}
          </div>
          ${state.gateway.passOnFees ? '<div class="tgpm-fee-note">The PayMongo service fee will be calculated and shown before you confirm payment.</div>' : ''}

          <button class="tgpm-button is-success is-wide" id="tgpmPayButton" type="button">${payButtonText(data.totalBalance)}</button>
          <div class="tgpm-alert" id="tgpmPayError" role="alert"></div>
          <div class="tgpm-actions">
            <button class="tgpm-link" id="tgpmBackButton" type="button">Use a different account</button>
            <a class="tgpm-link" href="${manualUrl()}">Use manual payment instead</a>
          </div>
          ${poweredBy()}
        </div>
      </section>
    `;

    document.querySelectorAll('.tgpm-method').forEach(button => {
      button.addEventListener('click', () => selectMethod(button.dataset.method));
    });
    document.getElementById('tgpmPayButton').addEventListener('click', createCheckout);
    document.getElementById('tgpmBackButton').addEventListener('click', renderLookup);
  }

  function methodButton(method) {
    const details = paymentMethodDetails(method);
    const selected = method === state.selectedMethod;
    return `
      <button class="tgpm-method${selected ? ' is-selected' : ''}" data-method="${escapeHtml(method)}" type="button" role="radio" aria-checked="${selected ? 'true' : 'false'}">
        <span class="tgpm-method-mark">${escapeHtml(details.mark)}</span>
        <span class="tgpm-method-copy"><strong>${escapeHtml(details.label)}</strong><span>${escapeHtml(details.description)}</span></span>
        <span class="tgpm-method-check" aria-hidden="true">✓</span>
      </button>
    `;
  }

  function selectMethod(method) {
    state.selectedMethod = method;
    document.querySelectorAll('.tgpm-method').forEach(button => {
      const selected = button.dataset.method === method;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    const payButton = document.getElementById('tgpmPayButton');
    if (payButton) payButton.textContent = payButtonText(state.bill.totalBalance);
  }

  function payButtonText(amount) {
    const details = paymentMethodDetails(state.selectedMethod);
    return 'Pay ' + money(amount) + ' via ' + details.label;
  }

  async function createCheckout() {
    const button = document.getElementById('tgpmPayButton');
    const errorBox = document.getElementById('tgpmPayError');
    clearError(errorBox);
    if (!state.selectedMethod) {
      showError(errorBox, 'Please choose a payment method.');
      return;
    }

    setBusy(button, true, 'Creating secure checkout…');
    try {
      const data = await apiPost('createPayMongoCheckout', {
        accountNo: state.accountNo,
        phone: state.phone,
        paymentMethod: state.selectedMethod
      });
      if (!data.ok || !/^https:\/\/checkout\.paymongo\.com\//i.test(String(data.checkoutUrl || ''))) {
        throw new Error(data.message || 'Unable to create a secure checkout.');
      }
      try {
        sessionStorage.setItem('tgpmPendingPayment', JSON.stringify({
          referenceNumber: data.referenceNumber,
          statusToken: data.statusToken,
          createdAt: Date.now()
        }));
      } catch (_) {}
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      showError(errorBox, error.message || 'Unable to open PayMongo checkout. Please try again.');
      setBusy(button, false, payButtonText(state.bill.totalBalance));
    }
  }

  function renderCheckingStatus(reference, token) {
    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card">
        <div class="tgpm-status" id="tgpmStatusPanel">
          <div class="tgpm-status-icon">↻</div>
          <div class="tgpm-processing"><span class="tgpm-spinner" aria-hidden="true"></span>Confirming with PayMongo</div>
          <h1>Checking your payment</h1>
          <p>Please keep this page open. Your Billing Ledger will update only after PayMongo confirms the payment.</p>
          <div class="tgpm-status-grid">
            <div class="tgpm-status-item"><span>Reference</span><strong>${escapeHtml(reference)}</strong></div>
            <div class="tgpm-status-item"><span>Gateway</span><strong>PayMongo</strong></div>
            <div class="tgpm-status-item"><span>Status</span><strong id="tgpmStatusValue">Checking…</strong></div>
          </div>
          <div class="tgpm-alert" id="tgpmStatusError" role="alert"></div>
          ${poweredBy()}
        </div>
      </section>
    `;
    checkStatus(reference, token, 0);
  }

  async function checkStatus(reference, token, attempt) {
    try {
      const data = await apiPost('checkPayMongoStatus', {
        referenceNumber: reference,
        statusToken: token
      });
      if (!data.ok) throw new Error(data.message || 'Unable to check payment status.');
      if (data.posted) {
        renderPaymentResult(data, 'paid');
        clearSensitiveQuery();
        return;
      }
      if (data.needsReview) {
        renderPaymentResult(data, 'review');
        clearSensitiveQuery();
        return;
      }

      const statusValue = document.getElementById('tgpmStatusValue');
      if (statusValue) statusValue.textContent = 'Processing';
      if (attempt < 7) {
        state.statusPoll = window.setTimeout(() => checkStatus(reference, token, attempt + 1), 7500);
      } else {
        renderPaymentResult(data, 'pending');
      }
    } catch (error) {
      const errorBox = document.getElementById('tgpmStatusError');
      if (errorBox) showError(errorBox, error.message || 'Payment status is temporarily unavailable.');
      if (attempt < 3) {
        state.statusPoll = window.setTimeout(() => checkStatus(reference, token, attempt + 1), 8000);
      }
    }
  }

  function renderPaymentResult(data, type) {
    stopPolling();
    const paid = type === 'paid';
    const review = type === 'review';
    const title = paid ? 'Payment posted successfully' : review ? 'Payment received for review' : 'Payment confirmation is processing';
    const icon = paid ? '✓' : review ? '!' : '↻';
    const copy = paid
      ? 'Your payment has been applied automatically to the TechGeekPH Billing Ledger.'
      : review
        ? 'PayMongo confirmed your payment, but the billing team needs to review its allocation.'
        : 'PayMongo has not confirmed the final status yet. The system will continue checking automatically every five minutes.';
    const className = paid ? ' is-paid' : review ? ' is-review' : '';

    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card">
        <div class="tgpm-status${className}">
          <div class="tgpm-status-icon">${icon}</div>
          <h1>${title}</h1>
          <p>${copy}</p>
          <div class="tgpm-status-grid">
            <div class="tgpm-status-item"><span>Reference</span><strong>${escapeHtml(data.referenceNumber || '—')}</strong></div>
            <div class="tgpm-status-item"><span>Amount</span><strong>${money(data.amount)}</strong></div>
            <div class="tgpm-status-item"><span>Billing status</span><strong>${paid ? 'PAID' : review ? 'NEEDS REVIEW' : 'PROCESSING'}</strong></div>
          </div>
          <div class="tgpm-actions" style="justify-content:center">
            <button class="tgpm-button" id="tgpmNewPayment" type="button">Check another bill</button>
            <a class="tgpm-link" href="${manualUrl()}">Contact billing / manual payment</a>
          </div>
          ${poweredBy()}
        </div>
      </section>
    `;
    document.getElementById('tgpmNewPayment').addEventListener('click', () => {
      clearSensitiveQuery();
      renderLookup();
    });
  }

  function renderCancelled(reference) {
    shell().innerHTML = `
      ${trustBar()}
      <section class="tgpm-card">
        <div class="tgpm-status is-review">
          <div class="tgpm-status-icon">×</div>
          <h1>Payment was not completed</h1>
          <p>No Billing Ledger update was made. You can safely try again or choose a manual payment channel.</p>
          ${reference ? `<div class="tgpm-status-grid"><div class="tgpm-status-item" style="grid-column:1/-1"><span>Reference</span><strong>${escapeHtml(reference)}</strong></div></div>` : ''}
          <div class="tgpm-actions" style="justify-content:center">
            <button class="tgpm-button" id="tgpmTryAgain" type="button">Try again</button>
            <a class="tgpm-link" href="${manualUrl()}">Use manual payment</a>
          </div>
          ${poweredBy()}
        </div>
      </section>
    `;
    document.getElementById('tgpmTryAgain').addEventListener('click', () => {
      clearSensitiveQuery();
      renderLookup();
    });
  }

  function trustBar() {
    const mode = state.gateway && state.gateway.mode === 'live' ? 'live' : 'test';
    return `
      <div class="tgpm-trustbar">
        <div class="tgpm-trust-copy">
          <span class="tgpm-lock" aria-hidden="true">⌁</span>
          <div><strong>Secure TechGeekPH billing</strong><span>Payment is processed by PayMongo; billing posts only after API confirmation.</span></div>
        </div>
        <span class="tgpm-mode" data-mode="${mode}">${mode === 'live' ? 'Live payment' : 'Test mode'}</span>
      </div>
    `;
  }

  function steps(current) {
    const labels = ['Verify account', 'Choose payment', 'Auto-post billing'];
    return `<div class="tgpm-steps" aria-label="Payment progress">${labels.map((label, index) => {
      const number = index + 1;
      const statusClass = number < current ? ' is-done' : number === current ? ' is-current' : '';
      return `<div class="tgpm-step${statusClass}"><span class="tgpm-step-number">${number < current ? '✓' : number}</span><span>${label}</span></div>`;
    }).join('')}</div>`;
  }

  function poweredBy() {
    return '<div class="tgpm-powered"><span>Secure checkout powered by</span><strong>paymongo</strong></div>';
  }

  function paymentMethodDetails(method) {
    if (METHOD_DETAILS[method]) return METHOD_DETAILS[method];
    const label = String(method || 'Payment').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    return { label, mark: label.slice(0, 3).toUpperCase(), description: 'Continue through PayMongo secure checkout.' };
  }

  function shell() {
    return document.getElementById('tgpmShell');
  }

  function manualUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = 'paymentOptionsSection';
    url.searchParams.set('manual', '1');
    return escapeHtml(url.toString());
  }

  function clearSensitiveQuery() {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = '';
    cleanUrl.hash = '';
    window.history.replaceState({}, document.title, cleanUrl.toString());
    try { sessionStorage.removeItem('tgpmPendingPayment'); } catch (_) {}
  }

  function stopPolling() {
    if (state.statusPoll) window.clearTimeout(state.statusPoll);
    state.statusPoll = null;
  }

  async function apiGet(action) {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('_', String(Date.now()));
    const response = await fetchWithTimeout(url.toString(), { method: 'GET', cache: 'no-store' }, 15000);
    return parseApiResponse(response);
  }

  async function apiPost(action, payload) {
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload || {}))
    }, 60000);
    return parseApiResponse(response);
  }

  async function parseApiResponse(response) {
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw new Error('The billing server returned an unreadable response.'); }
    if (!response.ok || !data.ok) throw new Error(data.message || 'The billing request could not be completed.');
    return data;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .finally(() => window.clearTimeout(timeout));
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = text;
  }

  function clearError(element) {
    if (!element) return;
    element.textContent = '';
    element.classList.remove('is-visible');
  }

  function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-visible');
  }

  function money(value) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function clean(value, maxLength) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength || 500);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

