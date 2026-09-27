(function () {
  var ROLE_MAP = {
    "dotnet-backend-developer": ".NET Backend Developer",
    "data-analyst": "Data Analyst",
    "full-stack-developer": "Full Stack Developer",
  };

  var EXPERIENCE_RANGES = [
    { value: "0-1", label: "0 – 1" },
    { value: "1-3", label: "1 – 3" },
    { value: "3-5", label: "3 – 5" },
    { value: "5-7", label: "5 – 7" },
    { value: "7-10", label: "7 – 10" },
    { value: "10-plus", label: "+10" },
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function populateSelect(select, options) {
    if (!select || select.options.length > 1) return;
    options.forEach(function (option) {
      var el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });
  }

  function populateFormSelects(form) {
    populateSelect(form.querySelector('select[name="yearsOfExperience"]'), EXPERIENCE_RANGES);
  }

  function applyRoleFromQuery(form) {
    var params = new URLSearchParams(window.location.search);
    var roleSlug = params.get("role");
    if (!roleSlug) return "General application";

    var roleTitle = ROLE_MAP[roleSlug] || "General application";
    var roleInput = form.querySelector('input[name="role"]');
    var slugInput = form.querySelector('input[name="roleSlug"]');

    if (roleInput) roleInput.value = roleTitle;
    if (slugInput) slugInput.value = roleSlug;
    form.setAttribute("data-role", roleTitle);

    var lead = document.querySelector("[data-careers-apply-lead]");
    if (lead && ROLE_MAP[roleSlug]) {
      lead.textContent =
        "Applying for " + roleTitle + ". Complete the form below and our careers team will be in touch.";
    }

    var intro = document.querySelector("[data-careers-apply-intro]");
    if (intro && ROLE_MAP[roleSlug]) {
      intro.textContent = "Share your background and CV for the " + roleTitle + " role.";
    }

    return roleTitle;
  }

  function showError(form, message) {
    var existing = form.querySelector(".careers-apply-form__error");
    if (existing) existing.remove();

    var error = document.createElement("p");
    error.className = "careers-apply-form__error";
    error.setAttribute("role", "alert");
    error.textContent = message;
    form.querySelector(".submit-btn").before(error);
  }

  var MAX_RESUME_BYTES = 5 * 1024 * 1024;

  function showSuccess(form, role, reference) {
    var success = document.createElement("div");
    success.className = "careers-apply-form careers-apply-form--success";
    success.setAttribute("role", "status");
    success.innerHTML =
      "<h3>" +
      "Application received" +
      "</h3>" +
      "<p>Thank you for applying for <strong>" +
      escapeHtml(role) +
      "</strong>." +
      " Our HR team has received your details and CV and will review your submission." +
      "</p>" +
      (reference ? '<p class="careers-apply-form__reference">Reference: <strong>' + escapeHtml(reference) + '</strong></p>' : '') +
      '<button type="button" class="submit-btn" data-careers-apply-reset>Submit another application</button>';

    form.replaceWith(success);

    success.querySelector("[data-careers-apply-reset]").addEventListener("click", function () {
      success.replaceWith(form);
      form.reset();
      var roleTitle = applyRoleFromQuery(form);
      populateFormSelects(form);
      form.setAttribute("data-role", roleTitle);
    });
  }

  document.querySelectorAll("form.careers-apply-form").forEach(function (form) {
    populateFormSelects(form);
    var role = applyRoleFromQuery(form);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!form.reportValidity()) return;

      var resume = form.querySelector('input[name="resume"]').files[0];
      if (!resume || resume.size === 0) {
        showError(form, "CV upload is required.");
        return;
      }
      if (resume.size > MAX_RESUME_BYTES) {
        showError(form, "CV must be 5 MB or smaller.");
        return;
      }

      form.querySelector('input[name="expectedSalaryRange"]').value = form.querySelector('input[name="expectedSalary"]').value;
      form.querySelector('input[name="noticePeriod"]').value = form.querySelector('input[name="noticePeriodWeeks"]').value;

      var button = form.querySelector(".submit-btn");
      var originalHtml = button.innerHTML;
      button.disabled = true;
      button.textContent = "Submitting...";

      var existingError = form.querySelector(".careers-apply-form__error");
      if (existingError) existingError.remove();

      var submitUrl = form.getAttribute("data-submit-url");

      fetch(submitUrl, {
        method: "POST",
        body: new FormData(form),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) {
              throw new Error((data && data.error) || "Submission failed. Please try again.");
            }
            return data;
          });
        })
        .then(function (data) {
          showSuccess(form, role, data.reference);
        })
        .catch(function (error) {
          showError(form, error.message || "Submission failed. Please try again.");
          button.disabled = false;
          button.innerHTML = originalHtml;
        });
    });
  });
})();
