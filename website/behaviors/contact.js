(function () {
  'use strict';
  var config = JSON.parse(document.currentScript.getAttribute('data-contact-messages')).form;
  var form = document.getElementById('contactForm');
  if (!form) return;
  var button = form.querySelector('button[type="submit"]');
  var label = document.getElementById('submitText');
  var error = document.getElementById('contactFormError');
  var situation = form.elements.namedItem('situation');
  var sending = false;
  function buttonText() {
    var choice = (config.buttonTexts || []).find(function (entry) { return entry.value === situation.value; });
    label.textContent = choice ? choice.label : config.buttonText;
  }
  situation.addEventListener('change', function () { if (!sending) buttonText(); });
  buttonText();
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    // Older page scripts have demo submit handlers. This handler owns this form.
    event.stopImmediatePropagation();
    if (sending || !form.reportValidity()) return;
    sending = true;
    button.disabled = true;
    error.hidden = true;
    label.textContent = config.sendingText;
    var values = new FormData(form);
    var payload = {};
    ['situation', 'name', 'org', 'role', 'email', 'message', 'website'].forEach(function (key) { payload[key] = values.get(key) || ''; });
    try {
      var response = await fetch('/api/v1/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Submission failed');
      form.reset();
      label.textContent = config.successMessage;
      label.setAttribute('role', 'status');
    } catch (_) {
      error.textContent = config.errorMessage;
      error.hidden = false;
      buttonText();
    } finally {
      sending = false;
      button.disabled = false;
    }
  }, true);
})();
