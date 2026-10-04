(function () {
  'use strict';
  var vacancies = JSON.parse(document.currentScript.getAttribute('data-vacancies'));
  var form = document.querySelector('form.careers-apply-form');
  if (!form) return;
  var button = form.querySelector('.submit-btn');
  var buttonNodes = Array.from(button.childNodes);
  var sending = false;
  var ranges = [['0-1', '0 – 1'], ['1-3', '1 – 3'], ['3-5', '3 – 5'], ['5-7', '5 – 7'], ['7-10', '7 – 10'], ['10-plus', '+10']];
  var experience = form.elements.namedItem('yearsOfExperience');
  ranges.forEach(function (range) { experience.add(new Option(range[1], range[0])); });
  function setRole() {
    var slug = new URLSearchParams(location.search).get('role');
    var vacancy = vacancies.find(function (item) { return item.slug === slug; });
    var title = vacancy ? vacancy.title : 'General application';
    form.elements.namedItem('role').value = title;
    form.elements.namedItem('roleSlug').value = vacancy ? vacancy.slug : '';
    form.setAttribute('data-role', title);
    if (vacancy) {
      document.querySelector('[data-careers-apply-lead]').textContent = 'Applying for ' + title + '. Complete the form below and our careers team will be in touch.';
      document.querySelector('[data-careers-apply-intro]').textContent = 'Share your background and CV for the ' + title + ' role.';
    }
    return title;
  }
  var role = setRole();
  function showError(message) {
    var error = form.querySelector('.careers-apply-form__error');
    if (!error) { error = document.createElement('p'); error.className = 'careers-apply-form__error'; error.setAttribute('role', 'alert'); button.before(error); }
    error.textContent = message;
  }
  function element(tag, text, className) {
    var el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    var resume = form.elements.namedItem('resume').files[0];
    if (!resume || resume.size === 0) return showError('CV upload is required.');
    if (resume.size > 5 * 1024 * 1024) return showError('CV must be 5 MB or smaller.');
    if (!/\.(pdf|doc|docx)$/i.test(resume.name)) return showError('CV must be a PDF, DOC, or DOCX file.');
    form.elements.namedItem('expectedSalaryRange').value = form.elements.namedItem('expectedSalary').value;
    form.elements.namedItem('noticePeriod').value = form.elements.namedItem('noticePeriodWeeks').value;
    sending = true;
    button.disabled = true;
    button.textContent = 'Submitting...';
    form.querySelector('.careers-apply-form__error')?.remove();
    try {
      var response = await fetch(form.getAttribute('data-submit-url'), { method: 'POST', body: new FormData(form) });
      var data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Submission failed. Please try again.');
      var success = element('div', '', 'careers-apply-form careers-apply-form--success');
      success.setAttribute('role', 'status');
      success.append(element('h3', 'Application received'));
      var message = element('p');
      message.append('Thank you for applying for ', element('strong', role), '. Our HR team has received your details and CV and will review your submission.');
      success.append(message);
      if (data.reference) { var reference = element('p', 'Reference: ', 'careers-apply-form__reference'); reference.append(element('strong', String(data.reference))); success.append(reference); }
      var reset = element('button', 'Submit another application', 'submit-btn');
      reset.type = 'button';
      reset.setAttribute('data-careers-apply-reset', '');
      success.append(reset);
      form.replaceWith(success);
      reset.addEventListener('click', function () { success.replaceWith(form); form.reset(); role = setRole(); });
    } catch (error) {
      showError(error.message || 'Submission failed. Please try again.');
    } finally {
      sending = false;
      button.disabled = false;
      button.replaceChildren.apply(button, buttonNodes);
    }
  });
})();
