(function () {
  var ROLE_MAP = {
    "dotnet-backend-developer": ".NET Backend developer",
    "data-analyst": "Data Analyst",
    "full-stack-developer": "Full Stack Developer",
  };

  var SALARY_RANGES = [
    { value: "0-5", label: "0 – 5 K" },
    { value: "5-10", label: "5 – 10 K" },
    { value: "10-15", label: "10 – 15 K" },
    { value: "15-20", label: "15 – 20 K" },
    { value: "20-25", label: "20 – 25 K" },
    { value: "25-30", label: "25 – 30 K" },
    { value: "30-35", label: "30 – 35 K" },
    { value: "40-45", label: "40 – 45 K" },
    { value: "45-50", label: "45 – 50 K" },
    { value: "50-55", label: "50 – 55 K" },
    { value: "55-60", label: "55 – 60 K" },
    { value: "60-70", label: "60 – 70 K" },
    { value: "70-80", label: "70 – 80 K" },
    { value: "80-90", label: "80 – 90 K" },
    { value: "90-100", label: "90 – 100 K" },
    { value: "100-110", label: "100 – 110 K" },
  ];

  var NOTICE_PERIODS = [
    { value: "immediate", label: "Immediate" },
    { value: "week", label: "Week" },
    { value: "2-weeks", label: "2 Weeks" },
    { value: "3-weeks", label: "3 Weeks" },
    { value: "month", label: "Month" },
    { value: "month-and-half", label: "Month & Half" },
    { value: "2-months", label: "2 Months" },
  ];

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
    populateSelect(form.querySelector('select[name="expectedSalaryRange"]'), SALARY_RANGES);
    populateSelect(form.querySelector('select[name="noticePeriod"]'), NOTICE_PERIODS);
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

  var CAREERS_EMAIL = "careers@digitalhub.com.eg";
  var MAX_RESUME_BYTES = 5 * 1024 * 1024;

  function optionLabel(options, value) {
    var match = options.filter(function (option) {
      return option.value === value;
    })[0];
    return match ? match.label : value;
  }

  function submitViaMailto(form, role) {
    var data = new FormData(form);
    var resume = data.get("resume");

    if (!(resume instanceof File) || resume.size === 0) {
      throw new Error("CV upload is required.");
    }

    if (resume.size > MAX_RESUME_BYTES) {
      throw new Error("CV must be 5 MB or smaller.");
    }

    var body = [
      "Role: " + role,
      "Full Name: " + data.get("fullName"),
      "Phone: " + data.get("phone"),
      "Email: " + data.get("email"),
      "Current Salary (EGP - K): " + data.get("currentSalary"),
      "Years of Experience: " + optionLabel(EXPERIENCE_RANGES, String(data.get("yearsOfExperience"))),
      "Expected Salary Range: " + optionLabel(SALARY_RANGES, String(data.get("expectedSalaryRange"))),
      "Notice Period: " + optionLabel(NOTICE_PERIODS, String(data.get("noticePeriod"))),
      "LinkedIn: " + data.get("linkedin"),
      "",
      "Please attach your CV (" + resume.name + ") before sending this email.",
    ].join("\n");

    var mailto =
      "mailto:" +
      CAREERS_EMAIL +
      "?subject=" +
      encodeURIComponent("Application - " + role) +
      "&body=" +
      encodeURIComponent(body);

    window.location.href = mailto;
  }

  function showSuccess(form, role, staticSubmission) {
    var success = document.createElement("div");
    success.className = "careers-apply-form careers-apply-form--success";
    success.setAttribute("role", "status");
    success.innerHTML =
      "<h3>" +
      (staticSubmission ? "Almost done" : "Application received") +
      "</h3>" +
      "<p>Thank you for applying for <strong>" +
      escapeHtml(role) +
      "</strong>." +
      (staticSubmission
        ? " Your email app should open with your details. Attach your CV, then send the message to complete your application."
        : " Our careers team will review your submission and get back to you soon.") +
      "</p>" +
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

      var button = form.querySelector(".submit-btn");
      var originalHtml = button.innerHTML;
      button.disabled = true;
      button.textContent = "Submitting...";

      var existingError = form.querySelector(".careers-apply-form__error");
      if (existingError) existingError.remove();

      var submitUrl = form.getAttribute("data-submit-url");

      if (!submitUrl) {
        try {
          submitViaMailto(form, role);
          showSuccess(form, role, true);
        } catch (error) {
          showError(form, error.message || "Submission failed. Please try again.");
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
        return;
      }

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
        .then(function () {
          showSuccess(form, role, false);
        })
        .catch(function (error) {
          showError(form, error.message || "Submission failed. Please try again.");
          button.disabled = false;
          button.innerHTML = originalHtml;
        });
    });
  });
})();
