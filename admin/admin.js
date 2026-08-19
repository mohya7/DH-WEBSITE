(function () {
  'use strict';

  var collectionInfo = {
    services: { title: 'Services', singular: 'service', description: 'Homepage service cards plus full service-page suite and methodology (design stays the same).', icon: 'ti-stack-2', color: '#2ca8ea' },
    caseStudies: { title: 'Case Studies', singular: 'case study', description: 'Manage project outcomes shown on the homepage and work pages.', icon: 'ti-briefcase', color: '#f29a32' },
    blogs: { title: 'Blog', singular: 'article', description: 'Manage article body, cluster, FAQ, and static page output.', icon: 'ti-news', color: '#8f78ed' },
    news: { title: 'News', singular: 'news item', description: 'Manage Latest News cards and expandable full-details copy on the news hub.', icon: 'ti-antenna', color: '#f29a32' },
    partners: { title: 'Partners', singular: 'partner', description: 'Manage technology partners, logos, summaries, and page links.', icon: 'ti-building-skyscraper', color: '#36c99a' },
    jobs: { title: 'Vacancies', singular: 'vacancy', description: 'Manage open roles, locations, departments, and contract types.', icon: 'ti-id-badge-2', color: '#e56883' },
    team: { title: 'Leadership Team', singular: 'team member', description: 'Manage leadership profiles, contact details, and display order.', icon: 'ti-users-group', color: '#4fb3d7' }
  };

  var schemas = {
    services: [
      { name: 'title', label: 'Service name', required: true, full: true, placeholder: 'Enterprise Software Solutions' },
      { name: 'summary', label: 'Short description', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'icon', label: 'Tabler icon', direction: 'ltr', placeholder: 'ti-stack-2' },
      { name: 'visual', label: 'Visual style', type: 'select', options: [['code', 'Code'], ['data', 'Data'], ['ai', 'Artificial Intelligence'], ['team', 'Team']] },
      { type: 'section', label: 'Full service page — suite modules' },
      { name: 'suiteScenes', label: 'What we deliver — suite modules', type: 'suiteScenes', full: true, imageSize: '1400 × 900 px', imageNote: 'Landscape photo shown in the suite stage', hint: 'Edits update the full designed service page (not a stub). Title, description, feature bullets, and stage image per module.' },
      { type: 'section', label: 'Full service page — methodology' },
      { name: 'methodology', label: 'Methodology section', type: 'methodology', full: true, imageSize: '1400 × 900 px', imageNote: 'Landscape photo for each stage', hint: 'Edits update the methodology section on the full service page. Stage numbers update automatically.' }
    ],
    caseStudies: [
      { name: 'title', label: 'Outcome headline', required: true, full: true },
      { name: 'summary', label: 'Case study summary', type: 'textarea', required: true, full: true, max: 900 },
      { name: 'image', label: 'Card image', type: 'image', full: true, imageSize: '1600 × 1000 px', imageNote: '16:10 landscape' },
      { name: 'alt', label: 'Accessible image description', full: true, placeholder: 'Short description of the card image', hint: 'Shown as the image alt text on case study cards.' },
      { name: 'metric', label: 'Featured metric', placeholder: '500+ endpoints' },
      { name: 'categories', label: 'Categories', full: true, placeholder: 'data-analytics, enterprise-software', hint: 'Separate categories with commas.' }
    ],
    news: [
      { name: 'title', label: 'Headline', required: true, full: true },
      { name: 'summary', label: 'Short summary', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'details', label: 'Full details', type: 'textarea', required: true, full: true, max: 5000, hint: 'Shown under the card when Full details is expanded on the news page.' },
      { name: 'category', label: 'Category', type: 'select', options: [['Partnership', 'Partnership'], ['Events', 'Events'], ['Projects', 'Projects'], ['Company', 'Company']] },
      { name: 'location', label: 'Location', placeholder: 'Cairo, Egypt' },
      { name: 'year', label: 'Year', placeholder: '2025', direction: 'ltr' },
      { name: 'month', label: 'Month', placeholder: 'May', direction: 'ltr' },
      { name: 'image', label: 'Card image', type: 'image', full: true, imageSize: '1400 × 900 px', imageNote: 'Landscape photo for homepage carousel and news hub' },
      { name: 'alt', label: 'Accessible image description', full: true, placeholder: 'Short description of the news image' }
    ],
    blogs: [
      { name: 'title', label: 'Article title', required: true, full: true },
      { name: 'summary', label: 'Card summary', type: 'textarea', required: true, full: true, max: 700, hint: 'Short blurb for cards and listings — not the answer block.' },
      { type: 'section', label: 'SEO' },
      { name: 'seoTitle', label: 'SEO title', type: 'charcount', full: true, maxChars: 60, placeholder: 'Defaults to the article title if empty', hint: 'Used for <title>, Open Graph, and Twitter. Warns over 60 characters.' },
      { name: 'metaDescription', label: 'Meta description', type: 'charcount', textarea: true, full: true, maxChars: 155, rows: 3, placeholder: 'Defaults to the card summary if empty', hint: 'Used for meta description, Open Graph, Twitter, and BlogPosting JSON-LD. Warns over 155 characters.' },
      { name: 'cluster', label: 'Cluster', type: 'select', required: true, full: true, options: [
        ['DEX & Digital Employee Experience', 'DEX & Digital Employee Experience'],
        ['Enterprise Software', 'Enterprise Software'],
        ['Data, Cloud & Digital Egypt 2030', 'Data, Cloud & Digital Egypt 2030'],
        ['AI & Automation', 'AI & Automation'],
        ['Technical Talent & Outsourcing', 'Technical Talent & Outsourcing']
      ] },
      { name: 'answerBlock', label: 'Answer block (40–60 words)', type: 'wordcount', full: true, minWords: 40, maxWords: 60, max: 2000 },
      { name: 'body', label: 'Article body (HTML)', type: 'html', full: true, minWords: 1800, maxWords: 2500, hint: 'Use H2 headings for the table of contents. Body is the source of truth for the static page.' },
      { name: 'faq', label: 'FAQ (min 5 before publish)', type: 'faq', full: true },
      { name: 'dataCallouts', label: 'Data callouts', type: 'callouts', full: true },
      { name: 'relatedPosts', label: 'Related posts (same cluster, max 3)', type: 'related', full: true },
      { name: 'comparisonTable', label: 'Comparison table (required for vs titles)', type: 'comparison', full: true },
      { name: 'image', label: 'Cover image', type: 'image', full: true, imageSize: '1620 × 1000 px', imageNote: 'Wide landscape' },
      { name: 'alt', label: 'Accessible image description', full: true, placeholder: 'Short description of the cover image', hint: 'Required when a cover image is set. Shown as the image alt text on cards and the article page.' },
      { name: 'accent', label: 'Category color', type: 'select', options: [['blue', 'Blue'], ['orange', 'Orange']] },
      { name: 'readTime', label: 'Reading time (auto)', type: 'readonly', hint: 'Derived from word count at 225 wpm on save.' }
    ],
    partners: [
      { name: 'name', label: 'Partner name', required: true, full: true },
      { name: 'summary', label: 'Partnership summary', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'image', label: 'Partner logo', type: 'image', full: true, imageSize: '1200 × 400 px', imageNote: 'Transparent PNG preferred' },
      { name: 'alt', label: 'Accessible image description', full: true, placeholder: 'Microsoft logo', hint: 'Usually the partner name plus “logo”.' },
      { name: 'variant', label: 'Logo treatment', type: 'select', options: [['default', 'Default'], ['ms', 'Microsoft / Wide']] }
    ],
    jobs: [
      { name: 'title', label: 'Job title', required: true, full: true },
      { name: 'summary', label: 'Short summary', type: 'textarea', required: true, full: true, max: 700, hint: 'Shown on Careers cards and job listings.' },
      { name: 'department', label: 'Department', placeholder: 'Engineering' },
      { name: 'type', label: 'Contract type', type: 'select', required: true, options: [['Full time', 'Full time'], ['Remote', 'Remote'], ['Hybrid', 'Hybrid']] },
      { name: 'location', label: 'Location', placeholder: 'Cairo, New Cairo' },
      { type: 'section', label: 'Job sections' },
      { name: 'aboutRole', label: 'About the Role', type: 'richtext', required: true, full: true, hint: 'Describe the role. Use Bold, Bullets, and Numbering.' },
      { name: 'keyResponsibilities', label: 'Key Responsibilities', type: 'richtext', required: true, full: true, hint: 'List the main responsibilities.' },
      { name: 'requiredSkills', label: 'Required Skills & Experience', type: 'richtext', required: true, full: true, hint: 'List required skills and experience.' },
      { name: 'niceToHave', label: 'Nice to Have', type: 'richtext', full: true, hint: 'Optional skills that are a plus.' },
      { name: 'roleOffers', label: 'What This Role Offers', type: 'richtext', full: true, hint: 'Benefits, growth, and what candidates get from this role.' },
      { type: 'section', label: 'Interview process' },
      { name: 'interviewStages', label: 'Interview stages', type: 'checklist', full: true, options: [['HR', 'HR'], ['Tech', 'Tech'], ['CEO', 'CEO'], ['CTO', 'CTO'], ['Marketing', 'Marketing'], ['Sales', 'Sales'], ['AI & Data', 'AI & Data']], hint: 'Stages used in Active Hiring Process when a candidate is accepted after phone screening.' }
    ],
    team: [
      { name: 'name', label: 'Team member name', required: true, full: true },
      { name: 'role', label: 'Role', required: true },
      { name: 'image', label: 'Profile photo', type: 'image', full: true, imageSize: '800 × 1000 px', imageNote: '4:5 portrait' },
      { name: 'alt', label: 'Accessible image description', full: true, placeholder: 'Portrait of Name, Role', hint: 'Describe the person in the photo for screen readers.' },
      { name: 'linkedin', label: 'Profile link', full: true, direction: 'ltr', placeholder: 'https://linkedin.com/in/...', hint: 'Shown as the LinkedIn button on the team card. Use a full URL.' }
    ]
  };

  var autoLinkedCollections = ['services', 'caseStudies', 'blogs', 'partners', 'jobs'];

  var pageInfo = {
    home: { title: 'Homepage', icon: 'ti-home', url: '../index.html' },
    blogs: { title: 'Blog', icon: 'ti-news', url: '../blogs/index.html' },
    news: { title: 'News', icon: 'ti-antenna', url: '../news/index.html' },
    cases: { title: 'Case Studies', icon: 'ti-briefcase', url: '../cases/index.html' },
    partners: { title: 'Partners', icon: 'ti-building-skyscraper', url: '../partners/index.html' },
    careers: { title: 'Careers', icon: 'ti-id-badge-2', url: '../careers/index.html' },
    about: { title: 'About Us', icon: 'ti-building-community', url: '../about-us.html' }
  };

  var state = {
    csrf: '',
    data: null,
    users: [],
    applications: [],
    staffInterviewers: [],
    onboardingRequests: [],
    onboardingStatus: 'all',
    onboardingSelectedId: '',
    applicationRole: 'all',
    applicationQuery: '',
    applicationStatus: 'all',
    applicationExperience: 'all',
    applicationNoticeMax: 'all',
    applicationSalaryMax: '',
    hrRole: '',
    hrQuery: '',
    hrSelectedId: '',
    hrFilter: 'open',
    analyticsFrom: '',
    analyticsTo: '',
    analyticsOutcome: 'all',
    analyticsAcceptedRows: [],
    analyticsRejectedRows: [],
    analyticsAcceptedShown: 0,
    analyticsRejectedShown: 0,
    calendarMonth: null,
    calendarSelectedDay: '',
    interviewLogQuery: '',
    interviewLogResult: 'all',
    interviewLogRole: 'all',
    interviewLogType: 'all',
    interviewLogFormat: 'all',
    interviewLogInterviewer: 'all',
    interviewLogFrom: '',
    interviewLogTo: '',
    interviewLogScore: 'all',
    interviewLogStatus: 'all',
    interviewLogNotes: 'all',
    interviewLogRounds: 'all',
    interviewLogActivity: 'all',
    interviewLogSelectedId: '',
    contactRequests: [],
    currentUser: null,
    permissions: null,
    currentCollection: 'blogs',
    currentView: 'dashboard',
    currentStatus: 'all',
    query: '',
    layout: 'grid',
    editingId: null,
    editingUserId: null,
    editingUserRole: 'hr',
    setupToken: '',
    currentPage: 'home',
    contactStatus: 'all',
    contactQuery: '',
    contactSituation: 'all',
    pendingDelete: null
  };

  var $ = function (selector, context) { return (context || document).querySelector(selector); };
  var $$ = function (selector, context) { return Array.prototype.slice.call((context || document).querySelectorAll(selector)); };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function titleOf(item) { return item.title || item.name || 'Untitled'; }

  function isAdmin() { return Boolean(state.currentUser && state.currentUser.role === 'admin'); }
  function isHr() { return Boolean(state.currentUser && state.currentUser.role === 'hr'); }
  function isMarketing() { return Boolean(state.currentUser && state.currentUser.role === 'marketing'); }
  function canUseOnboarding() {
    return Boolean(state.permissions && state.permissions.canUseOnboarding) || isHr() || isMarketing();
  }

  function allowedCollections() {
    return state.permissions ? state.permissions.collections : [];
  }

  function applySession(session) {
    state.currentUser = session.user;
    state.permissions = session.permissions;
    if (isHr()) {
      state.currentCollection = 'jobs';
      state.currentPage = 'home';
      state.layout = 'list';
    } else if (isMarketing()) {
      state.currentCollection = '';
      state.currentPage = 'home';
    } else if (isAdmin() && allowedCollections().length) {
      state.currentCollection = allowedCollections()[0];
    }
    $$('[data-admin-only]').forEach(function (node) { node.classList.toggle('role-hidden', !isAdmin()); });
    $$('[data-hr-only]').forEach(function (node) { node.classList.toggle('role-hidden', !isHr()); });
    $$('[data-marketing-only]').forEach(function (node) { node.classList.toggle('role-hidden', !isMarketing()); });
    $$('[data-onboarding]').forEach(function (node) { node.classList.toggle('role-hidden', !canUseOnboarding()); });
    $$('[data-onboarding-hr]').forEach(function (node) { node.classList.toggle('role-hidden', !isHr()); });
    $$('[data-onboarding-marketing]').forEach(function (node) { node.classList.toggle('role-hidden', !isMarketing()); });
    $('#currentUserName').textContent = state.currentUser.name || state.currentUser.username;
    $('#currentUserRole').textContent = isAdmin()
      ? 'Administrator'
      : (isMarketing()
        ? (state.currentUser.jobTitle || 'Marketing · Onboarding')
        : (state.currentUser.jobTitle ? state.currentUser.jobTitle : 'HR · Careers editor'));
    var brand = $('#sidebarBrandLabel');
    if (brand) {
      brand.textContent = isHr() ? 'HR PORTAL' : (isMarketing() ? 'MARKETING' : 'CONTENT STUDIO');
    }
    document.title = isHr()
      ? 'Digital Hub — HR Portal'
      : (isMarketing() ? 'Digital Hub — Marketing' : 'Digital Hub — Content Studio');
    var avatar = $('#currentUserAvatar');
    avatar.classList.toggle('has-photo', Boolean(state.currentUser.photo));
    if (state.currentUser.photo) {
      avatar.innerHTML = '<img src="' + escapeHtml(publicUrl(state.currentUser.photo)) + '" alt="">';
    } else {
      avatar.textContent = (state.currentUser.name || state.currentUser.username).split(/\s+/).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }
    applyRouteShell(resolveAccessibleRoute(readStoredAdminRoute()));
  }

  function publicUrl(value) {
    value = String(value || '');
    return /^(?:[a-z]+:|#|\/\/)/i.test(value) ? value : '../' + value.replace(/^\//, '');
  }

  function formatDate(value, includeTime) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('en-GB', includeTime
        ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
    } catch (_) { return '—'; }
  }

  function relativeTime(value) {
    var diff = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(diff)) return '—';
    var minutes = Math.max(0, Math.round(diff / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' hr ago';
    return formatDate(value, false);
  }

  async function api(url, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var method = options.method || 'GET';
    if (!/^(GET|HEAD)$/i.test(method) && state.csrf) {
      headers['X-CSRF-Token'] = state.csrf;
      if (state.data && state.data.meta) headers['If-Match'] = String(state.data.meta.revision);
    }
    var response = await fetch(url, Object.assign({}, options, { method: method, headers: headers, credentials: 'same-origin' }));
    var payload = await response.json().catch(function () { return {}; });
    if (response.status === 401 && url !== '/api/admin/login' && url !== '/api/admin/auth/setup-password') {
      showLogin();
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (response.status === 409 && payload.error === 'REVISION_CONFLICT') {
      await loadContent();
      throw new Error('Content changed in another session. The latest version has been loaded; review your edit and try again.');
    }
    if (!response.ok) throw new Error(payload.message || 'The operation could not be completed.');
    return payload;
  }

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="ti ti-loader-2 ti-spin"></i><span>Saving...</span>';
    } else {
      button.disabled = false;
      if (button.dataset.original) button.innerHTML = button.dataset.original;
    }
  }

  function toast(message, error) {
    var node = document.createElement('div');
    node.className = 'toast' + (error ? ' is-error' : '');
    node.innerHTML = '<i class="ti ' + (error ? 'ti-alert-triangle' : 'ti-circle-check') + '"></i><div><strong>' + (error ? 'Something went wrong' : 'Success') + '</strong><small>' + escapeHtml(message) + '</small></div><button type="button" aria-label="Close"><i class="ti ti-x"></i></button>';
    $('#toastStack').appendChild(node);
    node.querySelector('button').addEventListener('click', function () { node.remove(); });
    setTimeout(function () { if (node.isConnected) node.remove(); }, 4500);
  }

  function showLogin(options) {
    options = options || {};
    $('#loginShell').classList.remove('is-hidden');
    $('#appShell').classList.add('is-hidden');
    var setupToken = options.setupToken || '';
    var setupForm = $('#setupPasswordForm');
    var loginForm = $('#loginForm');
    if (setupToken) {
      state.setupToken = setupToken;
      loginForm.classList.add('is-hidden');
      setupForm.classList.remove('is-hidden');
      $('.login-copy .eyebrow').textContent = 'HR ACCOUNT SETUP';
      $('#loginTitle').innerHTML = 'Set your<br><em>password</em>';
      $('.login-copy p').textContent = 'Choose a password for your HR account, then sign in with your username.';
      $('#setupError').textContent = '';
      $('#setupPassword').value = '';
      $('#setupPasswordConfirm').value = '';
      setTimeout(function () { $('#setupPassword').focus(); }, 60);
      return;
    }
    state.setupToken = '';
    setupForm.classList.add('is-hidden');
    loginForm.classList.remove('is-hidden');
    $('.login-copy .eyebrow').textContent = 'SECURE ADMIN WORKSPACE';
    $('#loginTitle').innerHTML = 'Welcome to your<br><em>Content Studio</em>';
    $('.login-copy p').textContent = 'Manage every page and content card from one place, with drafts, ordering, and previews before publishing.';
    setTimeout(function () { $('#loginPassword').focus(); }, 60);
  }

  function showApp() {
    $('#loginShell').classList.add('is-hidden');
    $('#appShell').classList.remove('is-hidden');
  }

  async function loadContent() {
    state.data = await api('/api/admin/content');
    renderAll();
  }

  async function loadUsers() {
    if (!isAdmin()) return;
    var payload = await api('/api/admin/users');
    state.users = payload.users || [];
    renderUsers();
  }

  async function loadApplications() {
    if (!isHr()) {
      state.applications = [];
      return;
    }
    var payload = await api('/api/admin/applications');
    state.applications = payload.applications || [];
    await loadStaffInterviewers();
    renderApplications();
    renderHrPortal();
    renderDashboard();
    renderInterviewLogCounts();
    if (state.currentView === 'hrAnalytics') renderHrAnalytics();
    if (state.currentView === 'hrCalendar') renderHrCalendar();
    if (state.currentView === 'interviewLog') renderInterviewLog();
  }

  async function loadStaffInterviewers() {
    if (!isHr()) {
      state.staffInterviewers = [];
      return;
    }
    try {
      var payload = await api('/api/admin/staff-interviewers');
      state.staffInterviewers = payload.interviewers || [];
    } catch (_) {
      state.staffInterviewers = [];
    }
  }

  async function loadOnboarding() {
    if (!canUseOnboarding()) {
      state.onboardingRequests = [];
      return;
    }
    var payload = await api('/api/admin/onboarding');
    state.onboardingRequests = payload.requests || [];
    renderOnboarding();
    renderDashboard();
  }

  async function loadContactRequests() {
    if (!isAdmin()) return;
    var payload = await api('/api/admin/contact-requests');
    state.contactRequests = payload.requests || [];
    renderContactRequests();
  }

  async function bootstrap() {
    try {
      var params = new URLSearchParams(window.location.search);
      var setupToken = params.get('setup') || '';
      if (setupToken) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return showLogin({ setupToken: setupToken });
      }
      var session = await api('/api/admin/session');
      if (!session.authenticated) return showLogin();
      state.csrf = session.csrf;
      applySession(session);
      showApp();
      await loadContent();
      if (isHr()) await loadApplications();
      if (canUseOnboarding()) await loadOnboarding();
      if (isAdmin()) {
        await loadContactRequests();
        await loadUsers();
      }
      restoreAdminRoute();
    } catch (error) {
      showLogin();
      $('#loginError').textContent = error.message;
    }
  }

  function renderAll() {
    if (!state.data) return;
    renderCounts();
    renderDashboard();
    renderCollection();
    renderPageSelector();
    renderPageForm();
    if (isHr()) {
      renderApplications();
      renderHrPortal();
      if (state.currentView === 'hrAnalytics') renderHrAnalytics();
      if (state.currentView === 'hrCalendar') renderHrCalendar();
      if (state.currentView === 'interviewLog') renderInterviewLog();
      else renderInterviewLogCounts();
    }
    if (canUseOnboarding()) renderOnboarding();
    if (isAdmin()) {
      renderContactRequests();
      renderUsers();
    }
    $('#sideRevision').textContent = 'Revision ' + state.data.meta.revision;
    $('#toolRevision').textContent = '#' + state.data.meta.revision;
    $('#toolUpdated').textContent = formatDate(state.data.meta.updatedAt, true);
  }

  function allItems() {
    return allowedCollections().reduce(function (list, key) {
      return list.concat((state.data.collections[key] || []).map(function (item) { return { collection: key, item: item }; }));
    }, []);
  }

  function renderCounts() {
    Object.keys(collectionInfo).forEach(function (key) {
      var count = (state.data.collections[key] || []).length;
      $$('[data-count="' + key + '"]').forEach(function (node) { node.textContent = count; });
    });
  }

  function workDayBounds(date) {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0, 0, 0);
    var end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0, 0, 0);
    return { start: start, end: end };
  }

  function workWeekBounds(date) {
    var day = date.getDay(); // 0 Sun … 6 Sat
    var sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day, 10, 0, 0, 0);
    if (date < sunday) {
      sunday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() - 7, 10, 0, 0, 0);
    }
    var thursdayEnd = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 4, 18, 0, 0, 0);
    return { start: sunday, end: thursdayEnd };
  }

  function renderDashboard() {
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    var name = ((state.currentUser && (state.currentUser.name || state.currentUser.username)) || '').split(/\s+/)[0] || 'team';
    var dashGreeting = $('#dashGreeting');
    var dashWelcomeText = $('#dashWelcomeText');
    var dashKicker = $('#dashKicker');
    if (dashKicker) {
      dashKicker.textContent = isAdmin()
        ? 'DIGITAL HUB CMS'
        : (isMarketing() ? 'MARKETING WORKSPACE' : 'HR WORKSPACE');
    }
    if (dashGreeting) dashGreeting.innerHTML = escapeHtml(greeting) + ', ' + escapeHtml(name);
    if (dashWelcomeText) {
      dashWelcomeText.textContent = isAdmin()
        ? 'Website content, enquiries, and system tools in one overview.'
        : (isMarketing()
          ? 'Review onboarding packages and return joining assets to HR.'
          : 'Track applications, pipelines, interviews, and open roles.');
    }

    var onboarding = state.onboardingRequests || [];
    setText('#dashOnboardingSent', onboarding.filter(function (item) { return item.status === 'sent'; }).length);
    setText('#dashOnboardingReturned', onboarding.filter(function (item) { return item.status === 'returned'; }).length);
    setText('#dashOnboardingDraft', onboarding.filter(function (item) { return item.status === 'draft'; }).length);
    setText('#dashOnboardingCompleted', onboarding.filter(function (item) { return item.status === 'completed'; }).length);

    var apps = state.applications || [];
    var hiring = apps.filter(isInHiringProcess);
    var jobs = (((state.data || {}).collections || {}).jobs) || [];
    var openJobs = jobs.filter(function (job) { return job.status === 'published'; }).length;
    var newApps = apps.filter(function (item) { return (item.status || 'new') === 'new'; }).length;
    var openPipelines = hiring.filter(function (item) { return !isPipelineClosed(item); }).length;
    var offerCount = hiring.filter(function (item) { return pipelineStageKey(item) === 'offer'; }).length;
    var hiredCount = hiring.filter(function (item) {
      var offer = pipelineOf(item).offer || {};
      return offer.status === 'joined';
    }).length;

    var now = new Date();
    var todayHours = workDayBounds(now);
    var week = workWeekBounds(now);
    var scheduled = collectScheduledInterviews();
    var interviewsToday = scheduled.filter(function (event) {
      return event.at >= todayHours.start && event.at <= todayHours.end;
    }).length;
    var interviewsWeek = scheduled.filter(function (event) {
      return event.at >= week.start && event.at <= week.end;
    }).length;
    var upcoming = scheduled.filter(function (event) { return event.at >= now; }).slice(0, 6);

    setText('#dashNewApps', newApps);
    setText('#dashOpenPipelines', openPipelines);
    setText('#dashInterviewsWeek', interviewsWeek);
    setText('#dashInterviewsToday', interviewsToday + (interviewsToday === 1 ? ' today · ' : ' today · ') + 'Sun 10:00 – Thu 18:00');
    setText('#dashOffers', offerCount);
    setText('#dashOpenJobs', openJobs);
    setText('#dashHired', hiredCount);

    var funnelStages = [
      { key: 'phone_screen', label: 'Phone', icon: 'ti-phone' },
      { key: 'task', label: 'Tasks', icon: 'ti-checklist' },
      { key: 'interview', label: 'Interviews', icon: 'ti-messages' },
      { key: 'offer', label: 'Offer', icon: 'ti-file-certificate' }
    ];
    var funnelCounts = funnelStages.map(function (stage) {
      return hiring.filter(function (item) { return pipelineStageKey(item) === stage.key; }).length;
    });
    var funnelMax = Math.max(1, Math.max.apply(null, funnelCounts));
    var funnel = $('#dashFunnel');
    if (funnel) {
      funnel.innerHTML = funnelStages.map(function (stage, index) {
        var count = funnelCounts[index];
        var height = Math.max(12, Math.round(count / funnelMax * 100));
        return '<button class="dash-funnel__step" type="button" data-view-link="hrPortal" data-dash-hr-filter="' + stage.key + '">' +
          '<span class="dash-funnel__bar" style="--fill:' + height + '%"><b>' + count + '</b></span>' +
          '<i class="ti ' + stage.icon + '"></i>' +
          '<strong>' + escapeHtml(stage.label) + '</strong>' +
          '</button>';
      }).join('');
    }

    var upcomingList = $('#dashUpcomingList');
    var upcomingEmpty = $('#dashUpcomingEmpty');
    if (upcomingList && upcomingEmpty) {
      upcomingEmpty.classList.toggle('is-hidden', upcoming.length > 0);
      upcomingList.classList.toggle('is-hidden', upcoming.length === 0);
      upcomingList.innerHTML = upcoming.map(function (event) {
        var dayLabel = '';
        try {
          dayLabel = event.at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        } catch (_) {
          dayLabel = event.dayKey;
        }
        return '<button class="dash-row" type="button" data-open-pipeline="' + escapeHtml(event.applicationId) + '">' +
          '<span class="dash-row__time"><strong>' + escapeHtml(formatInterviewTime(event.at)) + '</strong><small>' + escapeHtml(dayLabel) + '</small></span>' +
          '<span class="dash-row__body"><strong>' + escapeHtml(event.candidate) + '</strong><small>' + escapeHtml(event.role) + ' · ' + escapeHtml(event.label) + ' · ' + escapeHtml(interviewFormatLabel(event.format)) + '</small></span>' +
          '<i class="ti ti-chevron-right"></i></button>';
      }).join('');
    }

    var attention = [];
    hiring.filter(function (item) { return pipelineStageKey(item) === 'phone_screen'; }).slice(0, 4).forEach(function (item) {
      attention.push({
        id: item.id,
        title: item.fullName || 'Candidate',
        meta: (item.role || 'Role') + ' · Phone screen pending',
        tone: 'phone'
      });
    });
    scheduled.filter(function (event) { return event.at < now && event.result === 'pending'; }).slice(0, 3).forEach(function (event) {
      if (attention.some(function (entry) { return entry.id === event.applicationId; })) return;
      attention.push({
        id: event.applicationId,
        title: event.candidate,
        meta: event.role + ' · Interview overdue',
        tone: 'overdue'
      });
    });
    attention = attention.slice(0, 6);
    var attentionList = $('#dashAttentionList');
    var attentionEmpty = $('#dashAttentionEmpty');
    if (attentionList && attentionEmpty) {
      attentionEmpty.classList.toggle('is-hidden', attention.length > 0);
      attentionList.classList.toggle('is-hidden', attention.length === 0);
      attentionList.innerHTML = attention.map(function (entry) {
        return '<button class="dash-row is-' + escapeHtml(entry.tone) + '" type="button" data-open-pipeline="' + escapeHtml(entry.id) + '">' +
          '<span class="dash-row__dot"></span>' +
          '<span class="dash-row__body"><strong>' + escapeHtml(entry.title) + '</strong><small>' + escapeHtml(entry.meta) + '</small></span>' +
          '<i class="ti ti-chevron-right"></i></button>';
      }).join('');
    }

    var entries = allItems();
    var published = entries.filter(function (entry) { return entry.item.status === 'published'; }).length;
    var drafts = entries.length - published;
    var percent = entries.length ? Math.round(published / entries.length * 100) : 0;
    setText('#statTotal', entries.length);
    setText('#statPublished', published);
    setText('#statDrafts', drafts);
    setText('#statUpdated', formatDate(state.data.meta.updatedAt, false));
    setText('#statUpdatedBy', 'By ' + (state.data.meta.updatedBy || 'system'));
    var ring = $('#publishedRing');
    if (ring) {
      ring.style.setProperty('--ring', percent + '%');
      var ringLabel = ring.querySelector('span');
      if (ringLabel) ringLabel.textContent = percent + '%';
    }

    var activityLink = $('#dashActivityLink');
    if (activityLink) {
      activityLink.dataset.viewLink = isAdmin() ? 'tools' : 'hrAnalytics';
      activityLink.innerHTML = (isAdmin() ? 'Tools' : 'History') + ' <i class="ti ti-arrow-right"></i>';
    }

    var actions = { create: ['ti-plus', ''], update: ['ti-pencil', ''], delete: ['ti-trash', ' activity-icon--delete'], upload: ['ti-photo-up', ' activity-icon--upload'], import: ['ti-database-import', ' activity-icon--upload'], 'page-update': ['ti-file-pencil', ''] };
    var audit = (state.data.meta.audit || []).slice(0, 6);
    var activityList = $('#activityList');
    if (activityList) {
      activityList.innerHTML = audit.length ? audit.map(function (event) {
        var action = actions[event.action] || ['ti-history', ''];
        return '<article class="activity-item"><span class="activity-icon' + action[1] + '"><i class="ti ' + action[0] + '"></i></span><div><strong>' + escapeHtml(event.label) + '</strong><small>' + escapeHtml(event.by || 'system') + '</small></div><span class="activity-time">' + escapeHtml(relativeTime(event.at)) + '</span></article>';
      }).join('') : '<div class="empty-state"><p>No activity has been recorded yet.</p></div>';
    }

    var sideTitle = $('#dashSideTitle');
    var sideMeta = $('#dashSideMeta');
    var chart = $('#distributionChart');
    if (isAdmin()) {
      if (sideTitle) sideTitle.textContent = 'Content distribution';
      if (sideMeta) sideMeta.textContent = 'Cards grouped by content type';
      var available = allowedCollections();
      var max = Math.max(1, Math.max.apply(null, available.map(function (key) { return (state.data.collections[key] || []).length; })));
      if (chart) {
        chart.innerHTML = available.map(function (key) {
          var info = collectionInfo[key];
          var count = (state.data.collections[key] || []).length;
          return '<div class="dist-row"><div class="dist-head"><span>' + escapeHtml(info.title) + '</span><strong>' + count + '</strong></div><div class="dist-track"><i style="--size:' + Math.max(4, Math.round(count / max * 100)) + '%;--bar:' + info.color + '"></i></div></div>';
        }).join('');
      }
    } else {
      if (sideTitle) sideTitle.textContent = 'Open vacancies';
      if (sideMeta) sideMeta.textContent = 'Published roles and applicant volume';
      var publishedJobs = jobs.filter(function (job) { return job.status === 'published'; });
      if (chart) {
        chart.innerHTML = publishedJobs.length
          ? publishedJobs.slice(0, 8).map(function (job) {
              var count = apps.filter(function (item) { return item.role === job.title; }).length;
              return '<button class="dash-vacancy" type="button" data-view-link="applications">' +
                '<span><strong>' + escapeHtml(job.title) + '</strong><small>' + escapeHtml(job.department || 'Open role') + '</small></span>' +
                '<b>' + count + '</b></button>';
            }).join('')
          : '<div class="empty-state"><p>No published vacancies yet.</p></div>';
      }
    }
  }

  function setText(selector, value) {
    var node = $(selector);
    if (node) node.textContent = value;
  }

  function readStoredAdminRoute() {
    var raw = String((window.location.hash || '').replace(/^#/, '')).trim();
    if (!raw) {
      try { raw = String(sessionStorage.getItem('dh-admin-route') || '').trim(); } catch (_) { raw = ''; }
    }
    if (!raw || raw === 'dashboard') return { view: 'dashboard', collection: null };
    var parts = raw.split('/').filter(Boolean);
    if (parts[0] === 'content' && parts[1]) {
      return { view: 'content', collection: decodeURIComponent(parts[1]) };
    }
    if (parts[0] && Object.prototype.hasOwnProperty.call(collectionInfo, parts[0])) {
      return { view: 'content', collection: parts[0] };
    }
    return { view: parts[0], collection: null };
  }

  function routeIsAllowed(route) {
    var view = (route && route.view) || 'dashboard';
    var collection = route && route.collection;
    if (collection) view = 'content';
    if (isHr() && (view === 'users' || view === 'tools' || view === 'contactRequests' || view === 'pages')) return false;
    if (isMarketing() && view !== 'dashboard' && view !== 'onboarding') return false;
    if (isAdmin() && (view === 'applications' || view === 'hrPortal' || view === 'hrAnalytics' || view === 'hrCalendar' || view === 'interviewLog' || view === 'onboarding' || collection === 'jobs')) return false;
    if (collection && allowedCollections().indexOf(collection) === -1) return false;
    if (view === 'content' && !collection) return false;
    var viewNode = document.getElementById(view + 'View');
    if (view !== 'content' && !viewNode) return false;
    return true;
  }

  function resolveAccessibleRoute(route) {
    if (routeIsAllowed(route)) return route;
    return { view: 'dashboard', collection: null };
  }

  function applyRouteShell(route) {
    route = resolveAccessibleRoute(route || { view: 'dashboard', collection: null });
    var view = route.view || 'dashboard';
    var collection = route.collection || null;
    if (collection) {
      state.currentCollection = collection;
      if (collection === 'jobs') state.layout = 'list';
      view = 'content';
    }
    state.currentView = view;
    $$('.view').forEach(function (node) { node.classList.toggle('is-active', node.id === view + 'View'); });
    $$('.side-link').forEach(function (node) {
      var active = collection ? node.dataset.collection === collection : node.dataset.view === view;
      if (!collection && view === 'content') active = node.dataset.collection === state.currentCollection;
      node.classList.toggle('is-active', Boolean(active));
    });
    writeAdminRoute(view, view === 'content' ? state.currentCollection : null);
  }

  function writeAdminRoute(view, collection) {
    var hash = 'dashboard';
    if (view === 'content' && collection) hash = 'content/' + encodeURIComponent(collection);
    else if (view && view !== 'dashboard') hash = String(view);
    try { sessionStorage.setItem('dh-admin-route', hash); } catch (_) {}
    var next = '#' + hash;
    if ((window.location.hash || '') === next) return;
    state._syncingRoute = true;
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search + next);
      } else {
        window.location.hash = hash;
      }
    } finally {
      state._syncingRoute = false;
    }
  }

  function restoreAdminRoute() {
    var route = resolveAccessibleRoute(readStoredAdminRoute());
    state._restoringRoute = true;
    try {
      switchView(route.view, route.collection || undefined);
    } finally {
      state._restoringRoute = false;
    }
  }

  function switchView(view, collection) {
    function deny(message) {
      if (!state._restoringRoute) toast(message, true);
      return false;
    }
    if (isHr() && (view === 'users' || view === 'tools' || view === 'contactRequests' || view === 'pages')) {
      return deny('Your HR account does not have access to this section.');
    }
    if (isMarketing() && view !== 'dashboard' && view !== 'onboarding') {
      return deny('Marketing accounts can only access Employee Onboarding.');
    }
    if (isAdmin() && (view === 'applications' || view === 'hrPortal' || view === 'hrAnalytics' || view === 'hrCalendar' || view === 'interviewLog' || view === 'onboarding' || collection === 'jobs')) {
      return deny('Hiring and onboarding tools are available to HR and Marketing accounts only.');
    }
    if (collection && allowedCollections().indexOf(collection) === -1) {
      return deny(isHr() ? 'Your HR account can only manage Careers content.' : 'You do not have access to this collection.');
    }
    if (collection) {
      state.currentCollection = collection;
      state.currentStatus = 'all';
      state.query = '';
      $('#collectionSearch').value = '';
      if (collection === 'jobs') state.layout = 'list';
      view = 'content';
    }
    state.currentView = view;
    $$('.view').forEach(function (node) { node.classList.toggle('is-active', node.id === view + 'View'); });
    $$('.side-link').forEach(function (node) {
      var active = collection ? node.dataset.collection === collection : node.dataset.view === view;
      if (!collection && view === 'content') active = node.dataset.collection === state.currentCollection;
      node.classList.toggle('is-active', active);
    });
    if (view === 'content') renderCollection();
    if (view === 'applications') renderApplications();
    if (view === 'hrPortal') renderHrPortal();
    if (view === 'hrAnalytics') renderHrAnalytics();
    if (view === 'hrCalendar') renderHrCalendar();
    if (view === 'interviewLog') renderInterviewLog();
    if (view === 'onboarding') renderOnboarding();
    if (view === 'contactRequests') renderContactRequests();
    writeAdminRoute(view, view === 'content' ? state.currentCollection : null);
    closeMobileMenu();
    if (!state._restoringRoute) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function itemMedia(item, collection) {
    if (item.image) {
      var mediaMod = collection === 'partners' ? ' is-logo' : (collection === 'team' ? ' is-portrait' : '');
      return '<div class="content-card__media' + mediaMod + '"><img src="' + escapeHtml(publicUrl(item.image)) + '" alt=""></div>';
    }
    var icon = collectionInfo[collection].icon;
    if (collection === 'services' && item.icon) icon = item.icon;
    return '<div class="content-card__media"><span class="content-card__placeholder"><i class="ti ' + escapeHtml(icon) + '"></i></span></div>';
  }

  function itemMeta(item, collection) {
    var values = [];
    if (collection === 'blogs') values = [['ti-clock', (item.readTime || 0) + ' min'], ['ti-tag', item.cluster || item.categoryLabel || item.category]];
    if (collection === 'caseStudies') values = [['ti-chart-bar', item.metric], ['ti-tags', (item.categories || []).join(', ')]];
    if (collection === 'jobs') values = [['ti-building', item.department], ['ti-map-pin', item.location], ['ti-clock', item.type]];
    if (collection === 'team') values = [['ti-briefcase', item.role], ['ti-brand-linkedin', item.linkedin || 'No profile link']];
    if (collection === 'services') values = [['ti-link', item.href]];
    if (collection === 'partners') values = [['ti-link', item.href]];
    return values.filter(function (entry) { return entry[1]; }).slice(0, 3).map(function (entry) {
      return '<span><i class="ti ' + entry[0] + '"></i>' + escapeHtml(entry[1]) + '</span>';
    }).join('');
  }

  function renderCollection() {
    if (!state.data) return;
    var info = collectionInfo[state.currentCollection];
    if (!info) return;
    if (state.currentCollection === 'jobs') state.layout = 'list';
    var source = (state.data.collections[state.currentCollection] || []).slice().sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    var query = state.query.trim().toLowerCase();
    var filtered = source.filter(function (item) {
      var statusMatch = state.currentStatus === 'all' || item.status === state.currentStatus;
      var textMatch = !query || JSON.stringify(item).toLowerCase().indexOf(query) > -1;
      return statusMatch && textMatch;
    });
    $('#collectionTitle').textContent = info.title;
    $('#collectionDescription').textContent = info.description;
    $('#addItemLabel').textContent = 'Add ' + info.singular;
    $('#allCount').textContent = source.length;
    $('#publishedCount').textContent = source.filter(function (item) { return item.status === 'published'; }).length;
    $('#draftCount').textContent = source.filter(function (item) { return item.status === 'draft'; }).length;
    $$('.status-tabs button').forEach(function (button) { button.classList.toggle('is-active', button.dataset.status === state.currentStatus); });
    var isJobsList = state.currentCollection === 'jobs';
    $('#contentGrid').classList.toggle('is-list', state.layout === 'list');
    $('#contentGrid').classList.toggle('is-jobs-list', isJobsList);
    $$('[data-layout]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.layout === state.layout);
      button.classList.toggle('is-hidden', isJobsList);
    });

    $('#contentGrid').innerHTML = filtered.map(function (item, index) {
      var status = item.status === 'draft' ? [' is-draft', 'Draft'] : ['', 'Published'];
      var endVacancyBtn = state.currentCollection === 'jobs' && item.status === 'published'
        ? '<button class="edit-btn job-end-btn" type="button" data-action="end-vacancy" title="End vacancy"><i class="ti ti-circle-x"></i><span>End</span></button>'
        : '';
      if (isJobsList) {
        return '<article class="content-card vacancy-row" data-id="' + escapeHtml(item.id) + '">' +
          '<div class="vacancy-row__icon"><i class="ti ti-id-badge-2"></i></div>' +
          '<div class="vacancy-row__main">' +
          '<div class="vacancy-row__title">' +
          '<h3>' + escapeHtml(titleOf(item)) + '</h3>' +
          '<span class="content-status' + status[0] + '">' + status[1] + '</span>' +
          (item.featured ? '<span class="vacancy-row__featured"><i class="ti ti-star-filled"></i> Featured</span>' : '') +
          '</div>' +
          '<p>' + escapeHtml(item.summary || '') + '</p>' +
          '<div class="content-meta vacancy-row__meta">' + itemMeta(item, 'jobs') + '</div>' +
          '</div>' +
          '<div class="vacancy-row__actions">' +
          '<button class="edit-btn" type="button" data-action="edit"><i class="ti ti-pencil"></i> Edit</button>' +
          endVacancyBtn +
          '<button class="card-action" type="button" data-action="duplicate" title="Duplicate"><i class="ti ti-copy"></i></button>' +
          (item.href ? '<a class="card-action" href="' + escapeHtml(publicUrl(item.href)) + '" target="_blank" rel="noopener" title="Preview"><i class="ti ti-external-link"></i></a>' : '') +
          '<div class="reorder-actions">' +
          '<button class="card-action" type="button" data-action="up" ' + (index === 0 ? 'disabled' : '') + ' title="Move up"><i class="ti ti-chevron-up"></i></button>' +
          '<button class="card-action" type="button" data-action="down" ' + (index === filtered.length - 1 ? 'disabled' : '') + ' title="Move down"><i class="ti ti-chevron-down"></i></button>' +
          '<button class="card-action is-danger" type="button" data-action="delete" title="Delete"><i class="ti ti-trash"></i></button>' +
          '</div></div></article>';
      }
      return '<article class="content-card" data-id="' + escapeHtml(item.id) + '">' + itemMedia(item, state.currentCollection) +
        '<span class="content-status' + status[0] + '">' + status[1] + '</span>' + (item.featured ? '<span class="featured-star" title="Featured"><i class="ti ti-star-filled"></i></span>' : '') +
        '<div class="content-card__body"><span class="content-card__type">' + escapeHtml(info.singular) + '</span><h3>' + escapeHtml(titleOf(item)) + '</h3><p>' + escapeHtml(item.summary || item.role || item.department || '') + '</p><div class="content-meta">' + itemMeta(item, state.currentCollection) + '</div></div>' +
        '<footer class="content-card__foot"><button class="edit-btn" type="button" data-action="edit"><i class="ti ti-pencil"></i> Edit</button>' + endVacancyBtn + '<button class="card-action" type="button" data-action="duplicate" title="Duplicate"><i class="ti ti-copy"></i></button>' +
        (item.href ? '<a class="card-action" href="' + escapeHtml(publicUrl(item.href)) + '" target="_blank" rel="noopener" title="Preview"><i class="ti ti-external-link"></i></a>' : '') +
        '<div class="reorder-actions"><button class="card-action" type="button" data-action="up" ' + (index === 0 ? 'disabled' : '') + ' title="Move up"><i class="ti ti-chevron-up"></i></button><button class="card-action" type="button" data-action="down" ' + (index === filtered.length - 1 ? 'disabled' : '') + ' title="Move down"><i class="ti ti-chevron-down"></i></button><button class="card-action is-danger" type="button" data-action="delete" title="Delete"><i class="ti ti-trash"></i></button></div></footer></article>';
    }).join('');
    $('#emptyState').classList.toggle('is-hidden', filtered.length > 0);
    $('#contentGrid').classList.toggle('is-hidden', filtered.length === 0);
  }

  function wordCount(value) {
    var text = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    return text.split(' ').filter(Boolean).length;
  }

  function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function charCountLabel(count, maxChars) {
    return count + ' / ' + maxChars + ' characters';
  }

  function currentClusterValue(item) {
    var select = $('#itemForm [name="cluster"]') || $('#dynamicFields [name="cluster"]');
    if (select && select.value) return select.value;
    return (item && item.cluster) || '';
  }

  function relatedOptionsHtml(item, selected) {
    var cluster = currentClusterValue(item);
    if (!cluster) return '<small>Select a cluster to see matching related posts.</small>';
    var selectedIds = Array.isArray(selected) ? selected : [];
    var options = ((state.data && state.data.collections.blogs) || []).filter(function (post) {
      return post.id !== (item && item.id) && post.cluster === cluster;
    });
    if (!options.length) return '<small>No other posts in this cluster yet.</small>';
    return options.map(function (post) {
      return '<label class="related-option"><input type="checkbox" name="relatedPosts" value="' + escapeHtml(post.id) + '"' + (selectedIds.indexOf(post.id) > -1 ? ' checked' : '') + '> ' + escapeHtml(post.title) + '</label>';
    }).join('');
  }

  function refreshRelatedPosts() {
    var list = $('[data-related-list]', $('#dynamicFields'));
    if (!list) return;
    var selected = $$('input[name="relatedPosts"]:checked', list).map(function (input) { return input.value; });
    var item = state.editingId
      ? (state.data.collections[state.currentCollection] || []).find(function (entry) { return entry.id === state.editingId; })
      : { id: null, cluster: currentClusterValue(null) };
    list.innerHTML = relatedOptionsHtml(item || { id: null }, selected);
  }

  function fieldHtml(field, item) {
    if (field.type === 'section') {
      return '<div class="dynamic-field dynamic-field--full editor-section"><strong>' + escapeHtml(field.label) + '</strong></div>';
    }
    var value = item && item[field.name] != null ? item[field.name] : '';
    if (field.name === 'categories' && Array.isArray(value)) value = value.join(', ');
    var required = field.required ? ' required' : '';
    var direction = field.direction ? ' style="direction:' + field.direction + ';text-align:left"' : '';
    var full = field.full ? ' dynamic-field--full' : '';
    var fieldMeta = field.required ? 'Required' : (field.type === 'image' ? field.imageSize : '');
    var label = '<span>' + escapeHtml(field.label) + (fieldMeta ? ' <em>' + escapeHtml(fieldMeta) + '</em>' : '') + '</span>';
    if (field.type === 'checklist') {
      var selected = Array.isArray(value) && value.length ? value : (field.options || []).map(function (option) { return option[0]; });
      var boxes = (field.options || []).map(function (option) {
        var checked = selected.indexOf(option[0]) > -1 ? ' checked' : '';
        return '<label class="checklist-option"><input type="checkbox" name="' + field.name + '" value="' + escapeHtml(option[0]) + '"' + checked + '><span>' + escapeHtml(option[1]) + '</span></label>';
      }).join('');
      return '<div class="dynamic-field' + full + '">' + label + '<div class="checklist-grid" data-checklist="' + escapeHtml(field.name) + '">' + boxes + '</div>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</div>';
    }
    if (field.type === 'image') {
      return '<label class="dynamic-field image-field">' + label + '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif"><div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop an image or click to browse</strong><small>PNG, JPG, WEBP — up to 5MB · converted to WebP</small><span class="image-size-hint"><b>' + escapeHtml(field.imageSize || 'Use a high-resolution image') + '</b>' + (field.imageNote ? '<em>' + escapeHtml(field.imageNote) + '</em>' : '') + '</span></div>' +
        (value ? '<img class="image-preview" src="' + escapeHtml(publicUrl(value)) + '" alt="Preview"><button class="image-remove" type="button" data-remove-image><i class="ti ti-x"></i></button>' : '') + '</div><input class="image-path" type="hidden" name="' + field.name + '" value="' + escapeHtml(value) + '"></label>';
    }
    if (field.type === 'readonly') {
      return '<label class="dynamic-field' + full + '">' + label + '<input name="' + field.name + '" type="text" value="' + escapeHtml(value || '—') + '" readonly>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
    }
    if (field.type === 'charcount') {
      var chars = String(value || '').length;
      var maxChars = field.maxChars || 60;
      var warnStyle = chars > maxChars ? ' style="color:#e56883"' : '';
      var control = field.textarea
        ? '<textarea name="' + field.name + '" rows="' + (field.rows || 3) + '" data-charcount data-max-chars="' + maxChars + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + direction + '>' + escapeHtml(value) + '</textarea>'
        : '<input name="' + field.name + '" type="text" value="' + escapeHtml(value) + '" data-charcount data-max-chars="' + maxChars + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + direction + '>';
      return '<label class="dynamic-field' + full + '">' + label + control + '<small class="word-count" data-charcount-label' + warnStyle + '>' + charCountLabel(chars, maxChars) + '</small>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
    }
    if (field.type === 'wordcount') {
      var count = wordCount(value);
      return '<label class="dynamic-field' + full + '">' + label + '<textarea name="' + field.name + '" rows="4" maxlength="' + (field.max || 2000) + '" data-wordcount data-min-words="' + (field.minWords || 40) + '" data-max-words="' + (field.maxWords || 60) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + required + direction + '>' + escapeHtml(value) + '</textarea><small class="word-count" data-wordcount-label>' + count + ' words (target ' + (field.minWords || 40) + '–' + (field.maxWords || 60) + ')</small></label>';
    }
    if (field.type === 'html') {
      var bodyCount = wordCount(value);
      var minWords = field.minWords || 0;
      var maxWords = field.maxWords || 0;
      var bodyWarn = minWords && bodyCount < minWords ? ' style="color:#e56883"' : '';
      var counter = (minWords || maxWords)
        ? '<small class="word-count" data-wordcount-label' + bodyWarn + '>' + formatNumber(bodyCount) + ' words (target ' + formatNumber(minWords) + '-' + formatNumber(maxWords) + ')</small>'
        : '';
      var wordAttrs = (minWords || maxWords)
        ? ' data-wordcount data-min-words="' + minWords + '" data-max-words="' + maxWords + '" data-wordcount-format="body"'
        : '';
      return '<label class="dynamic-field' + full + '">' + label + '<textarea name="' + field.name + '" rows="16" class="html-body" placeholder="<h2>...</h2><p>...</p>"' + wordAttrs + direction + '>' + escapeHtml(value) + '</textarea>' + counter + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
    }
    if (field.type === 'richtext') {
      var html = normalizeRichHtml(value);
      return '<div class="dynamic-field' + full + ' richtext-field" data-richtext-field>' + label +
        '<div class="richtext">' +
        '<div class="richtext-toolbar" role="toolbar" aria-label="Formatting">' +
        '<button type="button" class="richtext-btn" data-rich-cmd="formatBlock" data-rich-value="h1" title="Heading 1"><i class="ti ti-h-1"></i><span>H1</span></button>' +
        '<button type="button" class="richtext-btn" data-rich-cmd="formatBlock" data-rich-value="h2" title="Heading 2"><i class="ti ti-h-2"></i><span>H2</span></button>' +
        '<button type="button" class="richtext-btn" data-rich-cmd="formatBlock" data-rich-value="h3" title="Heading 3"><i class="ti ti-h-3"></i><span>H3</span></button>' +
        '<span class="richtext-sep" aria-hidden="true"></span>' +
        '<button type="button" class="richtext-btn" data-rich-cmd="bold" title="Bold"><i class="ti ti-bold"></i><span>Bold</span></button>' +
        '<button type="button" class="richtext-btn" data-rich-cmd="insertUnorderedList" title="Bullets"><i class="ti ti-list"></i><span>Bullets</span></button>' +
        '<button type="button" class="richtext-btn" data-rich-cmd="insertOrderedList" title="Numbering"><i class="ti ti-list-numbers"></i><span>Numbering</span></button>' +
        '</div>' +
        '<div class="richtext-editor" contenteditable="true" data-richtext-editor role="textbox" aria-multiline="true">' + (html || '<p><br></p>') + '</div>' +
        '<input type="hidden" name="' + field.name + '" value="' + escapeHtml(html) + '"' + required + '>' +
        '</div>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</div>';
    }
    if (field.type === 'suiteScenes') {
      var scenes = Array.isArray(value) && value.length ? value : [
        { title: 'Scene 01', description: '', features: [], image: '', alt: '' },
        { title: 'Scene 02', description: '', features: [], image: '', alt: '' },
        { title: 'Scene 03', description: '', features: [], image: '', alt: '' },
        { title: 'Scene 04', description: '', features: [], image: '', alt: '' }
      ];
      return '<div class="dynamic-field' + full + '" data-repeatable="suiteScenes">' + label +
        (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') +
        '<div class="repeatable-list" data-suite-list>' + scenes.map(function (row, index) {
          var sceneTitle = row.title || row.label || ('Scene ' + String(index + 1).padStart(2, '0'));
          var sceneDesc = row.description || '';
          var sceneImage = row.image || '';
          var sceneAlt = row.alt || '';
          var features = Array.isArray(row.features) && row.features.length ? row.features : [
            { icon: 'ti-circle', text: '' },
            { icon: 'ti-circle', text: '' },
            { icon: 'ti-circle', text: '' }
          ];
          while (features.length < 3) features.push({ icon: 'ti-circle', text: '' });
          features = features.slice(0, 5);
          return '<div class="repeatable-row" data-suite-row>' +
            '<strong style="display:block;margin-bottom:10px;font-size:11px;color:#8eb4d0">' + escapeHtml(String(index + 1).padStart(2, '0') + ' · Suite module') + '</strong>' +
            '<input name="suiteScenes[' + index + '].title" placeholder="Module title" value="' + escapeHtml(sceneTitle) + '">' +
            '<textarea name="suiteScenes[' + index + '].description" rows="3" placeholder="Module description under the title" style="margin-top:8px">' + escapeHtml(sceneDesc) + '</textarea>' +
            '<div data-suite-features style="display:grid;gap:8px;margin-top:10px">' +
            features.map(function (feature, featureIndex) {
              return '<div data-suite-feature style="display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px">' +
                '<input name="suiteScenes[' + index + '].features[' + featureIndex + '].icon" placeholder="ti-layout-grid" value="' + escapeHtml(feature.icon || 'ti-circle') + '" style="direction:ltr;text-align:left">' +
                '<input name="suiteScenes[' + index + '].features[' + featureIndex + '].text" placeholder="Feature text" value="' + escapeHtml(feature.text || '') + '">' +
                '</div>';
            }).join('') +
            '</div>' +
            '<small style="display:block;margin-top:6px">Feature icon = Tabler class (e.g. ti-layout-grid). Leave text blank to hide a row.</small>' +
            '<label class="image-field" style="display:block;margin-top:12px">' +
            '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif">' +
            '<div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop scene image or click to browse</strong>' +
            '<small>PNG, JPG, WEBP — up to 5MB · converted to WebP</small>' +
            '<span class="image-size-hint"><b>' + escapeHtml(field.imageSize || '1400 × 900 px') + '</b>' +
            (field.imageNote ? '<em>' + escapeHtml(field.imageNote) + '</em>' : '') + '</span></div>' +
            (sceneImage ? '<img class="image-preview" src="' + escapeHtml(publicUrl(sceneImage)) + '" alt="Preview"><button class="image-remove" type="button" data-remove-image><i class="ti ti-x"></i></button>' : '') +
            '</div><input class="image-path" type="hidden" name="suiteScenes[' + index + '].image" value="' + escapeHtml(sceneImage) + '"></label>' +
            '<input name="suiteScenes[' + index + '].alt" placeholder="Accessible image description" value="' + escapeHtml(sceneAlt) + '" style="margin-top:8px">' +
            '</div>';
        }).join('') + '</div></div>';
    }
    if (field.type === 'methodology') {
      var method = value && typeof value === 'object' ? value : {};
      var stages = Array.isArray(method.stages) && method.stages.length ? method.stages : [
        { title: 'Discover & Define', description: '', image: '', alt: '' },
        { title: 'Architect & Design', description: '', image: '', alt: '' },
        { title: 'Build & Integrate', description: '', image: '', alt: '' },
        { title: 'Deploy, Support & Improve', description: '', image: '', alt: '' }
      ];
      stages = stages.slice(0, 6);
      return '<div class="dynamic-field' + full + '" data-repeatable="methodology">' + label +
        (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') +
        '<div style="display:grid;gap:10px;margin-bottom:14px">' +
        '<input name="methodology.label" placeholder="Section label (e.g. Our methodology)" value="' + escapeHtml(method.label || 'Our methodology') + '">' +
        '<input name="methodology.title" placeholder="Section headline" value="' + escapeHtml(method.title || '') + '">' +
        '<textarea name="methodology.lead" rows="3" placeholder="Supporting paragraph under the headline">' + escapeHtml(method.lead || '') + '</textarea>' +
        '</div>' +
        '<div class="repeatable-list" data-method-list>' + stages.map(function (row, index) {
          var stageTitle = row.title || ('Stage ' + (index + 1));
          var stageDesc = row.description || '';
          var stageImage = row.image || '';
          var stageAlt = row.alt || '';
          return '<div class="repeatable-row" data-method-row>' +
            '<strong style="display:block;margin-bottom:10px;font-size:11px;color:#8eb4d0">' + escapeHtml(String(index + 1) + ' · Methodology stage') + '</strong>' +
            '<input name="methodology.stages[' + index + '].title" placeholder="Stage title" value="' + escapeHtml(stageTitle) + '">' +
            '<textarea name="methodology.stages[' + index + '].description" rows="3" placeholder="Stage description" style="margin-top:8px">' + escapeHtml(stageDesc) + '</textarea>' +
            '<label class="image-field" style="display:block;margin-top:12px">' +
            '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif">' +
            '<div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop stage image or click to browse</strong>' +
            '<small>PNG, JPG, WEBP — up to 5MB · converted to WebP</small>' +
            '<span class="image-size-hint"><b>' + escapeHtml(field.imageSize || '1400 × 900 px') + '</b>' +
            (field.imageNote ? '<em>' + escapeHtml(field.imageNote) + '</em>' : '') + '</span></div>' +
            (stageImage ? '<img class="image-preview" src="' + escapeHtml(publicUrl(stageImage)) + '" alt="Preview"><button class="image-remove" type="button" data-remove-image><i class="ti ti-x"></i></button>' : '') +
            '</div><input class="image-path" type="hidden" name="methodology.stages[' + index + '].image" value="' + escapeHtml(stageImage) + '"></label>' +
            '<input name="methodology.stages[' + index + '].alt" placeholder="Accessible image description" value="' + escapeHtml(stageAlt) + '" style="margin-top:8px">' +
            '</div>';
        }).join('') + '</div></div>';
    }
    if (field.type === 'faq') {
      var rows = Array.isArray(value) && value.length ? value : [{ question: '', answer: '' }];
      return '<div class="dynamic-field' + full + '" data-repeatable="faq">' + label + '<div class="repeatable-list" data-faq-list>' + rows.map(function (row, index) {
        return '<div class="repeatable-row" data-faq-row><input name="faq[' + index + '].question" placeholder="Question" value="' + escapeHtml(row.question || '') + '"><textarea name="faq[' + index + '].answer" rows="3" data-wordcount data-min-words="40" data-max-words="60" placeholder="Answer (40–60 words)">' + escapeHtml(row.answer || '') + '</textarea><small class="word-count">' + wordCount(row.answer || '') + ' words</small><button type="button" class="card-action is-danger" data-remove-row>Remove</button></div>';
      }).join('') + '</div><button type="button" class="edit-btn" data-add-faq><i class="ti ti-plus"></i> Add FAQ</button><small>Warns under 5 entries on publish (warn-only for now).</small></div>';
    }
    if (field.type === 'callouts') {
      var callouts = Array.isArray(value) && value.length ? value : [];
      return '<div class="dynamic-field' + full + '" data-repeatable="callouts">' + label + '<div class="repeatable-list" data-callout-list>' + (callouts.length ? callouts.map(function (row, index) {
        return '<div class="repeatable-row" data-callout-row><input name="dataCallouts[' + index + '].figure" placeholder="Figure / claim" value="' + escapeHtml(row.figure || '') + '"><input name="dataCallouts[' + index + '].source" placeholder="Source" value="' + escapeHtml(row.source || '') + '"><button type="button" class="card-action is-danger" data-remove-row>Remove</button></div>';
      }).join('') : '') + '</div><button type="button" class="edit-btn" data-add-callout><i class="ti ti-plus"></i> Add callout</button></div>';
    }
    if (field.type === 'related') {
      var selected = Array.isArray(value) ? value : [];
      return '<div class="dynamic-field' + full + '" data-related-field>' + label + '<div class="related-list" data-related-list>' + relatedOptionsHtml(item, selected) + '</div><small>Select up to 3 siblings in the same cluster.</small></div>';
    }
    if (field.type === 'comparison') {
      var table = value && typeof value === 'object' ? value : { columns: [], rows: [] };
      var columns = (table.columns || []).join(' | ');
      var rows = (table.rows || []).map(function (row) { return (row || []).join(' | '); }).join('\n');
      return '<div class="dynamic-field' + full + '">' + label + '<input name="comparisonColumns" placeholder="Column A | Column B | Column C" value="' + escapeHtml(columns) + '"><textarea name="comparisonRows" rows="6" placeholder="One row per line, cells separated by |">' + escapeHtml(rows) + '</textarea><small>Required when the title contains “vs” (warn-only for now).</small></div>';
    }
    var control;
    if (field.type === 'textarea') control = '<textarea name="' + field.name + '" rows="4" maxlength="' + (field.max || 1500) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + required + direction + '>' + escapeHtml(value) + '</textarea>';
    else if (field.type === 'select') control = '<select name="' + field.name + '"' + required + '>' + field.options.map(function (option) { return '<option value="' + escapeHtml(option[0]) + '"' + (String(value) === option[0] ? ' selected' : '') + '>' + escapeHtml(option[1]) + '</option>'; }).join('') + '</select>';
    else control = '<input name="' + field.name + '" type="' + (field.type || 'text') + '" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + (field.min != null ? ' min="' + field.min + '"' : '') + required + direction + '>';
    return '<label class="dynamic-field' + full + '">' + label + control + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
  }

  function normalizeRichHtml(raw) {
    var value = String(raw || '').trim();
    if (!value) return '';
    var looksEscaped = /&lt;\/?(?:h[1-6]|p|ul|ol|li|strong|b|em|br)\b/i.test(value)
      && !/<(?:h[1-6]|ul|ol|li)\b/i.test(value);
    if (!looksEscaped) return value;
    var holder = document.createElement('textarea');
    holder.innerHTML = value;
    var decoded = String(holder.value || '').trim();
    if (!decoded) return value;
    // Pasted HTML source often ends up as one escaped tag per <p>…</p>.
    if (/^<p[\s>]/i.test(decoded) && /&lt;/.test(value)) {
      var wrap = document.createElement('div');
      wrap.innerHTML = value;
      var pieces = [];
      Array.prototype.forEach.call(wrap.childNodes, function (node) {
        var text = String(node.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!text) return;
        pieces.push(text);
      });
      if (pieces.length) decoded = pieces.join('');
    }
    return decoded;
  }

  function syncRichTextFields(scope) {
    var root = scope || $('#itemForm') || document;
    var fields = root.matches && root.matches('[data-richtext-field]')
      ? [root]
      : $$('[data-richtext-field]', root);
    fields.forEach(function (field) {
      var editor = $('[data-richtext-editor]', field);
      var input = $('input[type="hidden"]', field);
      if (!editor || !input) return;
      var html = String(editor.innerHTML || '').trim();
      if (!html || html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') html = '';
      input.value = html;
    });
  }

  function applyRichCommand(command, value) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    var node = selection.anchorNode;
    var editor = node && node.nodeType === 1 ? node.closest('[data-richtext-editor]') : (node && node.parentElement && node.parentElement.closest('[data-richtext-editor]'));
    if (!editor) return;
    editor.focus();
    try {
      if (command === 'formatBlock') {
        var tag = String(value || 'p').replace(/[<>]/g, '').toLowerCase() || 'p';
        document.execCommand('formatBlock', false, '<' + tag + '>');
      } else {
        document.execCommand(command, false, null);
      }
    } catch (_) {}
    syncRichTextFields(editor.closest('[data-richtext-field]') || document);
  }

  function handleRichTextPaste(event) {
    var editor = event.target.closest && event.target.closest('[data-richtext-editor]');
    if (!editor) return;
    var clipboard = event.clipboardData || window.clipboardData;
    if (!clipboard) return;
    var htmlClip = clipboard.getData('text/html');
    var textClip = clipboard.getData('text/plain');
    var source = '';
    if (htmlClip && /<(?:h[1-6]|p|ul|ol|li|strong|b|em|div|br)\b/i.test(htmlClip)) {
      source = htmlClip;
    } else if (textClip && /<\/?[a-z][\s\S]*>/i.test(textClip)) {
      source = textClip;
    } else {
      return;
    }
    event.preventDefault();
    try { document.execCommand('insertHTML', false, source); } catch (_) {
      editor.focus();
      document.execCommand('insertText', false, textClip || '');
    }
    syncRichTextFields(editor.closest('[data-richtext-field]') || document);
  }

  function openEditor(id) {
    var info = collectionInfo[state.currentCollection];
    var item = id ? (state.data.collections[state.currentCollection] || []).find(function (entry) { return entry.id === id; }) : null;
    state.editingId = item ? item.id : null;
    $('#drawerKicker').textContent = item ? 'EDIT CONTENT' : 'NEW CONTENT';
    $('#editorTitle').textContent = item ? 'Edit ' + info.singular : 'Add ' + info.singular;
    $('#editorSubtitle').textContent = item
      ? 'Update the fields, then save to publish the change.'
      : (autoLinkedCollections.indexOf(state.currentCollection) > -1
        ? 'Complete the fields. The details link will be created automatically.'
        : 'Complete the fields, then save as a draft or publish now.');
    $('#dynamicFields').innerHTML = schemas[state.currentCollection].map(function (field) { return fieldHtml(field, item || {}); }).join('');
    $('#publishToggle').checked = !item || item.status === 'published';
    $('#featuredToggle').checked = Boolean(item && item.featured);
    $('#drawerDeleteBtn').classList.toggle('is-hidden', !item);
    var fullscreen = state.currentCollection === 'services' || state.currentCollection === 'jobs';
    $('#editorDrawer').classList.toggle('is-fullscreen', fullscreen);
    $('#editorDrawer').classList.add('is-open');
    $('#editorDrawer').setAttribute('aria-hidden', 'false');
    $('#drawerBackdrop').classList.toggle('is-open', !fullscreen);
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      var first = $('#dynamicFields input:not([type="hidden"]), #dynamicFields textarea, #dynamicFields [contenteditable="true"]');
      if (first) first.focus();
    }, 250);
  }

  function closeEditor() {
    $('#editorDrawer').classList.remove('is-open', 'is-fullscreen');
    $('#editorDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerBackdrop').classList.remove('is-open');
    document.body.style.overflow = '';
    state.editingId = null;
    $('#itemForm').reset();
  }

  async function saveItem(event) {
    event.preventDefault();
    syncRichTextFields();
    var button = $('#itemForm button[type="submit"]');
    var existing = state.editingId ? state.data.collections[state.currentCollection].find(function (entry) { return entry.id === state.editingId; }) : null;
    var payload = {};
    schemas[state.currentCollection].forEach(function (field) {
      if (field.type === 'faq' || field.type === 'callouts' || field.type === 'related' || field.type === 'comparison' || field.type === 'readonly' || field.type === 'section' || field.type === 'suiteScenes' || field.type === 'methodology') return;
      if (field.type === 'checklist') {
        payload[field.name] = $$('#itemForm input[name="' + field.name + '"]:checked').map(function (input) { return input.value; });
        return;
      }
      var input = $('#itemForm [name="' + field.name + '"]');
      if (!input) return;
      if (field.type === 'number') payload[field.name] = Number(input.value || 0);
      else if (field.name === 'categories') payload[field.name] = input.value.split(',').map(function (value) { return value.trim(); }).filter(Boolean);
      else payload[field.name] = input.value.trim();
    });
    if (state.currentCollection === 'blogs') {
      if (payload.image && !payload.alt) {
        toast('Add an accessible image description for the cover image.', true);
        return;
      }
      payload.faq = $$('[data-faq-row]', $('#itemForm')).map(function (row) {
        return {
          question: ($('input', row) || {}).value || '',
          answer: ($('textarea', row) || {}).value || ''
        };
      }).filter(function (entry) { return entry.question.trim() || entry.answer.trim(); });
      payload.dataCallouts = $$('[data-callout-row]', $('#itemForm')).map(function (row) {
        var inputs = $$('input', row);
        return { figure: (inputs[0] && inputs[0].value) || '', source: (inputs[1] && inputs[1].value) || '' };
      }).filter(function (entry) { return entry.figure.trim() || entry.source.trim(); });
      payload.relatedPosts = $$('input[name="relatedPosts"]:checked', $('#itemForm')).map(function (input) { return input.value; }).slice(0, 3);
      var columnsRaw = (($('#itemForm [name="comparisonColumns"]') || {}).value || '').trim();
      var rowsRaw = (($('#itemForm [name="comparisonRows"]') || {}).value || '').trim();
      if (columnsRaw || rowsRaw) {
        payload.comparisonTable = {
          columns: columnsRaw.split('|').map(function (value) { return value.trim(); }).filter(Boolean),
          rows: rowsRaw.split(/\r?\n/).map(function (line) {
            return line.split('|').map(function (value) { return value.trim(); });
          }).filter(function (row) { return row.some(Boolean); })
        };
      } else {
        payload.comparisonTable = null;
      }
      if (existing && existing.datePublished) payload.datePublished = existing.datePublished;
    }
    if (state.currentCollection === 'services') {
      payload.suiteScenes = $$('[data-suite-row]', $('#itemForm')).map(function (row) {
        return {
          title: (($('[name$=".title"]', row) || {}).value || '').trim(),
          description: (($('[name$=".description"]', row) || {}).value || '').trim(),
          image: (($('.image-path', row) || {}).value || '').trim(),
          alt: (($('[name$=".alt"]', row) || {}).value || '').trim(),
          features: $$('[data-suite-feature]', row).map(function (featureRow) {
            var inputs = $$('input', featureRow);
            return {
              icon: ((inputs[0] && inputs[0].value) || 'ti-circle').trim(),
              text: ((inputs[1] && inputs[1].value) || '').trim()
            };
          }).filter(function (feature) { return feature.text; })
        };
      });
      payload.methodology = {
        label: (($('#itemForm [name="methodology.label"]') || {}).value || '').trim(),
        title: (($('#itemForm [name="methodology.title"]') || {}).value || '').trim(),
        lead: (($('#itemForm [name="methodology.lead"]') || {}).value || '').trim(),
        stages: $$('[data-method-row]', $('#itemForm')).map(function (row) {
          return {
            title: (($('[name$=".title"]', row) || {}).value || '').trim(),
            description: (($('[name$=".description"]', row) || {}).value || '').trim(),
            image: (($('.image-path', row) || {}).value || '').trim(),
            alt: (($('[name$=".alt"]', row) || {}).value || '').trim()
          };
        }).filter(function (stage) { return stage.title || stage.description || stage.image; })
      };
    }
    payload.status = $('#publishToggle').checked ? 'published' : 'draft';
    payload.featured = $('#featuredToggle').checked;
    payload.order = existing ? existing.order : 0;
    try {
      setBusy(button, true);
      var url = '/api/admin/items/' + state.currentCollection + (state.editingId ? '/' + encodeURIComponent(state.editingId) : '');
      var result = await api(url, { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      state.data = result;
      renderAll();
      closeEditor();
      if (result.warnings && result.warnings.length) {
        toast('Saved with warnings: ' + result.warnings.join(' · '), true);
      } else {
        toast(existing ? 'The card was updated and the latest version is now live.' : 'The card was added to the content library.');
      }
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  async function uploadImage(file, uploadInput) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image is over 5 MB. Compress or resize it before uploading.', true);
    var field = uploadInput && uploadInput.closest ? uploadInput.closest('.image-field') : null;
    var scope = field || $('#dynamicFields');
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        toast('Optimizing and uploading image...');
        var result = await api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl: reader.result }) });
        state.data.meta.revision = result.revision;
        var pathInput = $('.image-path', scope);
        if (pathInput) pathInput.value = result.path;
        var drop = $('.image-drop', scope);
        if (drop) {
          var old = $('.image-preview', drop); if (old) old.remove();
          var image = document.createElement('img'); image.className = 'image-preview'; image.src = '../' + result.path; image.alt = 'Preview'; drop.appendChild(image);
          if (!$('[data-remove-image]', drop)) { var remove = document.createElement('button'); remove.className = 'image-remove'; remove.type = 'button'; remove.dataset.removeImage = ''; remove.innerHTML = '<i class="ti ti-x"></i>'; drop.appendChild(remove); }
        }
        toast('Image converted to WebP and uploaded. Save the card to apply it.');
      } catch (error) { toast(error.message, true); }
    };
    reader.readAsDataURL(file);
  }

  async function uploadUserPhoto(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image is over 5 MB. Compress or resize it before uploading.', true);
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        toast('Uploading profile photo...');
        var result = await api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl: reader.result }) });
        if (state.data && state.data.meta) state.data.meta.revision = result.revision;
        setUserPhotoPreview(result.path);
        toast('Photo uploaded. Save the account to apply it.');
      } catch (error) { toast(error.message, true); }
    };
    reader.readAsDataURL(file);
  }

  async function duplicateItem(id) {
    var source = state.data.collections[state.currentCollection].find(function (item) { return item.id === id; });
    if (!source) return;
    var clone = JSON.parse(JSON.stringify(source));
    delete clone.id; delete clone.updatedAt;
    if (clone.title) clone.title += ' — Copy';
    if (clone.name) clone.name += ' — Copy';
    clone.status = 'draft';
    clone.featured = false;
    clone.order = 0;
    try {
      state.data = await api('/api/admin/items/' + state.currentCollection, { method: 'POST', body: JSON.stringify(clone) });
      renderAll(); toast('A draft copy was created for safe editing.');
    } catch (error) { toast(error.message, true); }
  }

  async function moveItem(id, direction) {
    var sorted = state.data.collections[state.currentCollection].slice().sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    var index = sorted.findIndex(function (item) { return item.id === id; });
    var targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    var current = Object.assign({}, sorted[index]);
    var target = Object.assign({}, sorted[targetIndex]);
    var order = current.order; current.order = target.order; target.order = order;
    try {
      state.data = await api('/api/admin/items/' + state.currentCollection + '/' + encodeURIComponent(current.id), { method: 'PUT', body: JSON.stringify(current) });
      state.data = await api('/api/admin/items/' + state.currentCollection + '/' + encodeURIComponent(target.id), { method: 'PUT', body: JSON.stringify(target) });
      renderAll(); toast('Display order updated.');
    } catch (error) { toast(error.message, true); }
  }

  function askEndVacancy(jobId) {
    var jobs = (((state.data || {}).collections || {}).jobs) || [];
    var job = jobs.find(function (entry) { return entry.id === jobId; });
    if (!job) {
      toast('Vacancy not found.', true);
      return;
    }
    state.pendingDelete = { kind: 'vacancy', jobId: job.id, title: job.title || 'Vacancy' };
    $('#confirmTitle').textContent = 'End this vacancy?';
    $('#confirmText').textContent = '“' + (job.title || 'This vacancy') + '” will be unpublished and leave open vacancies. Candidates already in Active Hiring Process keep going until they are joined or rejected.';
    var confirmBtn = $('#confirmDeleteBtn');
    if (confirmBtn) confirmBtn.innerHTML = '<i class="ti ti-circle-x"></i> Yes, end vacancy';
    $('#modalBackdrop').classList.add('is-open');
  }

  function askDelete(id) {
    var item = state.data.collections[state.currentCollection].find(function (entry) { return entry.id === id; });
    if (!item) return;
    state.pendingDelete = { kind: 'content', collection: state.currentCollection, id: id };
    $('#confirmTitle').textContent = 'Delete this content?';
    if (state.currentCollection === 'jobs') {
      $('#confirmText').textContent = '“' + titleOf(item) + '” will be deleted from Careers. Candidates already in Active Hiring Process keep going until they are joined or rejected, then move to Analytics & History.';
    } else {
      $('#confirmText').textContent = '“' + titleOf(item) + '” will be removed from the admin panel and the website. This action cannot be undone.';
    }
    var confirmBtn = $('#confirmDeleteBtn');
    if (confirmBtn) confirmBtn.innerHTML = '<i class="ti ti-trash"></i> Yes, delete';
    $('#modalBackdrop').classList.add('is-open');
  }

  function closeConfirm() {
    $('#modalBackdrop').classList.remove('is-open');
    state.pendingDelete = null;
    var confirmBtn = $('#confirmDeleteBtn');
    if (confirmBtn) confirmBtn.innerHTML = '<i class="ti ti-trash"></i> Yes, delete';
  }

  async function confirmDelete() {
    if (!state.pendingDelete) return;
    var pending = state.pendingDelete;
    var button = $('#confirmDeleteBtn');
    try {
      setBusy(button, true);
      if (pending.kind === 'user') {
        var userResult = await api('/api/admin/users/' + encodeURIComponent(pending.id), { method: 'DELETE' });
        state.users = userResult.users || [];
        closeConfirm();
        renderUsers();
        toast('The account was deleted and all active sessions were revoked.');
        return;
      }
      if (pending.kind === 'vacancy') {
        var endResult = await api('/api/admin/vacancies/end', {
          method: 'POST',
          body: JSON.stringify({ jobId: pending.jobId })
        });
        if (endResult.content) state.data = endResult.content;
        state.applications = endResult.applications || state.applications;
        if (state.applicationRole === pending.title) state.applicationRole = '';
        if (state.hrSelectedId) {
          var stillSelected = (state.applications || []).some(function (entry) {
            return entry.id === state.hrSelectedId && isInHiringProcess(entry);
          });
          if (!stillSelected) state.hrSelectedId = '';
        }
        closeConfirm();
        renderAll();
        toast(
          'Vacancy ended.' +
          ((endResult.activeCount || 0)
            ? ' ' + endResult.activeCount + ' active candidate' + (endResult.activeCount === 1 ? '' : 's') + ' will continue until closed.'
            : '')
        );
        return;
      }
      var deleteResult = await api('/api/admin/items/' + pending.collection + '/' + encodeURIComponent(pending.id), { method: 'DELETE' });
      if (deleteResult.content) {
        state.data = deleteResult.content;
        if (Array.isArray(deleteResult.applications)) state.applications = deleteResult.applications;
      } else {
        state.data = deleteResult;
      }
      closeConfirm(); closeEditor(); renderAll();
      if (pending.collection === 'jobs') {
        toast(
          'Job deleted.' +
          ((deleteResult.activeCount || 0)
            ? ' ' + deleteResult.activeCount + ' active candidate' + (deleteResult.activeCount === 1 ? '' : 's') + ' will continue until closed.'
            : '')
        );
      } else {
        toast('The content was removed from the website.');
      }
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  function renderPageSelector() {
    var availablePages = state.permissions ? state.permissions.pages : [];
    $('#pageSelector').innerHTML = availablePages.map(function (key) {
      var page = pageInfo[key];
      return '<button type="button" data-page="' + key + '" class="' + (key === state.currentPage ? 'is-active' : '') + '"><i class="ti ' + page.icon + '"></i><span>' + escapeHtml(page.title) + '</span></button>';
    }).join('');
  }

  function historyFieldsHtml(history) {
    var data = history && typeof history === 'object' ? history : {};
    var milestones = Array.isArray(data.milestones) && data.milestones.length ? data.milestones : [
      { year: '2019', text: '', image: '', alt: '' }
    ];
    milestones = milestones.slice(0, 16);
    return '<div class="dynamic-field dynamic-field--full" data-repeatable="history">' +
      '<span><span>Our History timeline</span></span>' +
      '<small>Edit the section header and each year entry (text + image). First item is active by default.</small>' +
      '<div style="display:grid;gap:10px;margin:12px 0 14px">' +
      '<input name="history.label" placeholder="Section label (e.g. Since 2019)" value="' + escapeHtml(data.label || 'Since 2019') + '">' +
      '<input name="history.title" placeholder="Section headline" value="' + escapeHtml(data.title || 'Our History') + '">' +
      '<textarea name="history.lead" rows="3" placeholder="Supporting paragraph under the headline">' + escapeHtml(data.lead || '') + '</textarea>' +
      '</div>' +
      '<div class="repeatable-list" data-history-list>' + milestones.map(function (row, index) {
        var year = row.year || String(2019 + index);
        var text = row.text || '';
        var image = row.image || '';
        var alt = row.alt || '';
        return '<div class="repeatable-row" data-history-row>' +
          '<strong style="display:block;margin-bottom:10px;font-size:11px;color:#8eb4d0">' + escapeHtml(String(index + 1).padStart(2, '0') + ' · Timeline entry') + '</strong>' +
          '<div style="display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px">' +
          '<input name="history.milestones[' + index + '].year" placeholder="Year" value="' + escapeHtml(year) + '" style="direction:ltr;text-align:left">' +
          '<input name="history.milestones[' + index + '].text" placeholder="Milestone description" value="' + escapeHtml(text) + '">' +
          '</div>' +
          '<label class="image-field" style="display:block;margin-top:12px">' +
          '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif">' +
          '<div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop milestone image or click to browse</strong>' +
          '<small>PNG, JPG, WEBP — up to 5MB · converted to WebP</small>' +
          '<span class="image-size-hint"><b>1400 × 900 px</b><em>Landscape photo for this year</em></span></div>' +
          (image ? '<img class="image-preview" src="' + escapeHtml(publicUrl(image)) + '" alt="Preview"><button class="image-remove" type="button" data-remove-image><i class="ti ti-x"></i></button>' : '') +
          '</div><input class="image-path" type="hidden" name="history.milestones[' + index + '].image" value="' + escapeHtml(image) + '"></label>' +
          '<input name="history.milestones[' + index + '].alt" placeholder="Accessible image description" value="' + escapeHtml(alt) + '" style="margin-top:8px">' +
          '<button type="button" class="card-action is-danger" data-remove-history-row style="margin-top:10px">Remove</button>' +
          '</div>';
      }).join('') + '</div>' +
      '<button type="button" class="edit-btn" data-add-history style="margin-top:12px"><i class="ti ti-plus"></i> Add year</button>' +
      '</div>';
  }

  function renderPageForm() {
    if (!state.data || !state.data.pages[state.currentPage]) return;
    var page = state.data.pages[state.currentPage];
    var titleNode = $('#pageFormTitle');
    if (titleNode) titleNode.textContent = pageInfo[state.currentPage].title;
    var iconNode = $('.form-page-icon i');
    if (iconNode) iconNode.className = 'ti ' + pageInfo[state.currentPage].icon;
    ['label', 'title', 'lead', 'sectionTitle', 'sectionLead', 'seoTitle'].forEach(function (name) {
      var input = $('#pageForm [name="' + name + '"]');
      if (input) input.value = page[name] || '';
    });
    var seoOnly = $('.seo-only');
    if (seoOnly) seoOnly.classList.toggle('is-hidden', state.currentPage !== 'home');
    var socialBox = $('#homeSocialFields');
    if (socialBox) {
      var showSocial = state.currentPage === 'home';
      socialBox.classList.toggle('is-hidden', !showSocial);
      if (showSocial) {
        var social = page.social || {};
        ['linkedin', 'facebook', 'instagram', 'tiktok'].forEach(function (key) {
          var input = $('#pageForm [name="social.' + key + '"]');
          if (input) input.value = social[key] || '';
        });
      }
    }
    var historyBox = $('#aboutHistoryFields');
    if (historyBox) {
      var showHistory = state.currentPage === 'about';
      historyBox.classList.toggle('is-hidden', !showHistory);
      historyBox.innerHTML = showHistory ? historyFieldsHtml(page.history) : '';
    }
    updateCharCount();
  }

  function updateCharCount() {
    var lead = $('#pageForm [name="lead"]');
    if (lead) $('[data-char-count="lead"]').textContent = lead.value.length;
  }

  async function savePage(event) {
    event.preventDefault();
    var button = $('#pageForm button[type="submit"]');
    var payload = {};
    ['label', 'title', 'lead', 'sectionTitle', 'sectionLead', 'seoTitle'].forEach(function (name) {
      var input = $('#pageForm [name="' + name + '"]');
      if (input) payload[name] = String(input.value || '').trim();
    });
    if (state.currentPage === 'about') {
      payload.history = {
        label: (($('#pageForm [name="history.label"]') || {}).value || '').trim(),
        title: (($('#pageForm [name="history.title"]') || {}).value || '').trim(),
        lead: (($('#pageForm [name="history.lead"]') || {}).value || '').trim(),
        milestones: $$('[data-history-row]', $('#pageForm')).map(function (row) {
          return {
            year: (($('[name$=".year"]', row) || {}).value || '').trim(),
            text: (($('[name$=".text"]', row) || {}).value || '').trim(),
            image: (($('.image-path', row) || {}).value || '').trim(),
            alt: (($('[name$=".alt"]', row) || {}).value || '').trim()
          };
        }).filter(function (entry) { return entry.year || entry.text || entry.image; })
      };
    }
    if (state.currentPage === 'home') {
      payload.social = {
        linkedin: (($('#pageForm [name="social.linkedin"]') || {}).value || '').trim(),
        facebook: (($('#pageForm [name="social.facebook"]') || {}).value || '').trim(),
        instagram: (($('#pageForm [name="social.instagram"]') || {}).value || '').trim(),
        tiktok: (($('#pageForm [name="social.tiktok"]') || {}).value || '').trim()
      };
    }
    try {
      setBusy(button, true);
      state.data = await api('/api/admin/pages/' + state.currentPage, { method: 'PUT', body: JSON.stringify(payload) });
      renderAll(); toast('Page copy saved and the published version was updated.');
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  function exportContent() {
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'digital-hub-content-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast('A complete content backup was downloaded.');
  }

  async function importContent(file) {
    if (!file) return;
    try {
      var imported = JSON.parse(await file.text());
      if (!imported.pages || !imported.collections) throw new Error('This file does not contain a valid content structure.');
      if (!window.confirm('This will replace the current content with the selected backup. Continue?')) return;
      state.data = await api('/api/admin/content', { method: 'PUT', body: JSON.stringify(imported) });
      renderAll(); toast('The backup was imported and the website was updated.');
    } catch (error) { toast(error.message, true); }
    finally { $('#importInput').value = ''; }
  }

  function accountInitials(user) {
    return (user.name || user.username).split(/\s+/).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }

  function applicationInitials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }

  function applicationValue(value, suffix) {
    if (value == null || value === '') return '—';
    var spacing = suffix && !/^\s/.test(suffix) ? ' ' : '';
    return escapeHtml(String(value).replace(/-/g, ' – ') + spacing + (suffix || ''));
  }

  function numericUpper(value) {
    var matches = String(value == null ? '' : value).match(/\d+(?:\.\d+)?/g);
    return matches && matches.length ? Number(matches[matches.length - 1]) : NaN;
  }

  function noticeWeeks(item) {
    if (item.noticePeriodWeeks !== '' && item.noticePeriodWeeks != null && Number.isFinite(Number(item.noticePeriodWeeks))) return Number(item.noticePeriodWeeks);
    if (/^\d+$/.test(String(item.noticePeriod || ''))) return Number(item.noticePeriod);
    var legacy = { immediate: 0, week: 1, '2-weeks': 2, '3-weeks': 3, month: 4, 'month-and-half': 6, '2-months': 8 };
    return Object.prototype.hasOwnProperty.call(legacy, item.noticePeriod) ? legacy[item.noticePeriod] : NaN;
  }

  function noticeLabel(item) {
    var weeks = noticeWeeks(item);
    if (!Number.isFinite(weeks)) return '—';
    if (weeks === 0) return 'Immediate';
    return weeks + (weeks === 1 ? ' week' : ' weeks');
  }

  function salaryLabel(item) {
    var value = item.expectedSalary != null && item.expectedSalary !== '' ? item.expectedSalary : item.expectedSalaryRange;
    if (value == null || value === '') return '—';
    var raw = String(value).trim();
    var digits = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
    var num = Number(digits);
    if (Number.isFinite(num) && digits !== '' && /^\d+(\.\d+)?$/.test(digits)) {
      return escapeHtml(Math.round(num).toLocaleString('en-US')) + ' <span class="hr-salary-unit">EGP</span>';
    }
    if (raw.length > 18) raw = raw.slice(0, 16) + '…';
    return escapeHtml(raw);
  }

  function renderApplicationFilterOptions(list) {
    var experienceSelect = $('#applicationExperienceFilter');
    if (!experienceSelect) return;
    var experienceOrder = ['0-1', '1-3', '3-5', '5-7', '7-10', '10-plus'];
    var experience = Array.from(new Set(list.map(function (item) { return item.yearsOfExperience; }).filter(Boolean))).sort(function (a, b) {
      var aIndex = experienceOrder.indexOf(a); var bIndex = experienceOrder.indexOf(b);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
    });
    experienceSelect.innerHTML = '<option value="all">All experience</option>' + experience.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + applicationValue(value, ' years') + '</option>'; }).join('');
    experienceSelect.value = experience.indexOf(state.applicationExperience) > -1 ? state.applicationExperience : 'all';
    state.applicationExperience = experienceSelect.value;
  }

  function renderVacancyCards(list) {
    var rail = $('#applicationVacancyCards');
    if (!rail) return;
    var jobs = state.data && state.data.collections ? (state.data.collections.jobs || []).filter(function (job) { return job.status === 'published'; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); }) : [];
    if (!state.applicationRole) state.applicationRole = 'all';
    var cards = [{
      title: 'All applications',
      role: 'all',
      department: 'Complete inbox',
      location: '',
      count: list.length,
      newCount: list.filter(function (item) { return (item.status || 'new') === 'new'; }).length,
      icon: 'ti-inbox'
    }].concat(jobs.map(function (job) {
      var applicants = list.filter(function (item) { return item.role === job.title; });
      return {
        title: job.title,
        role: job.title,
        department: job.department || 'Open vacancy',
        location: job.location || '',
        type: job.type || '',
        count: applicants.length,
        newCount: applicants.filter(function (item) { return (item.status || 'new') === 'new'; }).length,
        icon: 'ti-id-badge-2'
      };
    }));
    rail.innerHTML = cards.map(function (card) {
      var active = state.applicationRole === card.role;
      var meta = [];
      if (card.location) meta.push(card.location);
      if (card.type) meta.push(card.type);
      if (card.role === 'all') meta.push('Every open role');
      return '<button class="apps-vacancy-row' + (active ? ' is-active' : '') + (card.role === 'all' ? ' is-inbox' : '') + '" type="button" aria-pressed="' + active + '" data-vacancy-role="' + escapeHtml(card.role) + '">' +
        '<span class="apps-vacancy-row__icon"><i class="ti ' + card.icon + '"></i></span>' +
        '<span class="apps-vacancy-row__copy">' +
        '<strong>' + escapeHtml(card.title) + '</strong>' +
        '<small>' + escapeHtml(card.department) + (meta.length ? ' · ' + escapeHtml(meta.join(' · ')) : '') + '</small>' +
        '</span>' +
        '<span class="apps-vacancy-row__aside">' +
        (card.newCount ? '<span class="apps-vacancy-row__badge">' + card.newCount + ' new</span>' : '') +
        '<span class="apps-vacancy-row__count">' + card.count + '</span>' +
        '</span></button>';
    }).join('');
  }

  function resetApplicationSecondaryFilters() {
    state.applicationQuery = '';
    state.applicationStatus = 'all';
    state.applicationExperience = 'all';
    state.applicationNoticeMax = 'all';
    state.applicationSalaryMax = '';
    $('#applicationSearch').value = '';
    $('#applicationStatusFilter').value = 'all';
    $('#applicationExperienceFilter').value = 'all';
    $('#applicationNoticeFilter').value = 'all';
    $('#applicationSalaryFilter').value = '';
  }

  function renderApplications() {
    var list = state.applications || [];
    if (!state.applicationRole) state.applicationRole = 'all';
    renderVacancyCards(list);
    var newCount = list.filter(function (item) { return item.status === 'new'; }).length;
    var progressCount = list.filter(function (item) { return item.status === 'reviewing' || item.status === 'contacted'; }).length;
    $$('[data-application-count]').forEach(function (node) { node.textContent = newCount; node.classList.toggle('is-zero', newCount === 0); });
    $('#applicationsTotal').textContent = list.length;
    $('#applicationsNew').textContent = newCount;
    $('#applicationsProgress').textContent = progressCount;

    var vacancySelected = Boolean(state.applicationRole);
    var inboxTitle = $('#applicationsInboxTitle');
    var inboxMeta = $('#applicationsInboxMeta');
    if (inboxTitle) {
      inboxTitle.textContent = state.applicationRole === 'all' ? 'All applications' : state.applicationRole;
    }
    $('#applicationSecondaryFilters').classList.toggle('is-hidden', !vacancySelected);
    $('#applicationsPickPrompt').classList.toggle('is-hidden', vacancySelected);
    if (!vacancySelected) {
      if (inboxMeta) inboxMeta.textContent = 'Select a vacancy to review candidates';
      $('#applicationsEmpty').classList.add('is-hidden');
      $('#applicationsList').classList.add('is-hidden');
      $('#applicationsList').innerHTML = '';
      return;
    }

    var vacancyApplicants = state.applicationRole === 'all' ? list : list.filter(function (item) { return item.role === state.applicationRole; });
    renderApplicationFilterOptions(vacancyApplicants);

    var query = state.applicationQuery.trim().toLowerCase();
    var filtered = vacancyApplicants.filter(function (item) {
      var statusMatch = state.applicationStatus === 'all' || item.status === state.applicationStatus;
      var experienceMatch = state.applicationExperience === 'all' || item.yearsOfExperience === state.applicationExperience;
      var noticeMatch = state.applicationNoticeMax === 'all' || (Number.isFinite(noticeWeeks(item)) && noticeWeeks(item) <= Number(state.applicationNoticeMax));
      var expectedSalary = numericUpper(item.expectedSalary != null ? item.expectedSalary : item.expectedSalaryRange);
      var salaryMatch = !state.applicationSalaryMax || (Number.isFinite(expectedSalary) && expectedSalary <= Number(state.applicationSalaryMax));
      var searchMatch = !query || [item.fullName, item.role, item.email, item.phone].join(' ').toLowerCase().indexOf(query) > -1;
      return statusMatch && experienceMatch && noticeMatch && salaryMatch && searchMatch;
    });
    if (inboxMeta) {
      inboxMeta.textContent = filtered.length + ' of ' + vacancyApplicants.length + ' candidate' + (vacancyApplicants.length === 1 ? '' : 's');
    }
    $('#applicationsEmpty').classList.toggle('is-hidden', filtered.length > 0);
    $('#applicationsList').classList.toggle('is-hidden', filtered.length === 0);
    $('#applicationsList').innerHTML = filtered.map(function (item) {
      var pipe = pipelineOf(item);
      var enrolled = Boolean(item.pipeline && typeof item.pipeline === 'object');
      var activeHire = isInHiringProcess(item);
      var closed = enrolled && isPipelineClosed(item);
      var status = String(item.status || 'new').toLowerCase();
      var outcome = closed ? pipelineOutcomeLabel(item) : '';
      var outcomeKey = String(outcome || '').toLowerCase().replace(/\s+/g, '-');
      var badge = activeHire
        ? '<span class="app-badge is-pipeline">' + escapeHtml(pipelineStageLabel(pipe.stage)) + '</span>'
        : (closed
          ? '<span class="app-badge is-' + escapeHtml(outcomeKey) + '">' + escapeHtml(outcome) + '</span>'
          : '<span class="app-badge is-' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>');
      var pipelineBtn = activeHire
        ? '<button class="primary-btn" type="button" data-open-pipeline="' + escapeHtml(item.id) + '"><i class="ti ti-user-search"></i> Open pipeline</button>'
        : (closed
          ? '<button class="secondary-btn" type="button" data-view-link="hrAnalytics"><i class="ti ti-history"></i> View history</button>'
          : '<button class="primary-btn" type="button" data-open-pipeline="' + escapeHtml(item.id) + '"><i class="ti ti-player-play"></i> Start pipeline</button>');
      var linkedin = String(item.linkedin || '').trim();
      var hasLinkedin = /^https?:\/\//i.test(linkedin);
      var ref = item.reference || item.id.replace('application-', '').slice(0, 8).toUpperCase();
      return '<article class="application-card" data-application-id="' + escapeHtml(item.id) + '">' +
        '<div class="application-card__top">' +
        '<div class="application-card__identity">' +
        '<span class="application-avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span>' +
        '<div class="application-card__copy">' +
        '<div class="application-card__title"><h3>' + escapeHtml(item.fullName) + '</h3>' + badge + '</div>' +
        '<p><span>' + escapeHtml(item.role || 'Role') + '</span><span>Ref ' + escapeHtml(ref) + '</span><span>' + escapeHtml(formatDate(item.submittedAt, true)) + '</span></p>' +
        '</div></div>' +
        '<div class="application-card__actions">' +
        (hasLinkedin ? '<a class="icon-btn" href="' + escapeHtml(linkedin) + '" target="_blank" rel="noopener" title="LinkedIn"><i class="ti ti-brand-linkedin"></i></a>' : '') +
        '<a class="icon-btn" href="/api/admin/applications/' + encodeURIComponent(item.id) + '/resume" title="Download CV"><i class="ti ti-download"></i></a>' +
        pipelineBtn +
        '</div></div>' +
        '<div class="application-card__meta">' +
        '<div><small>Email</small><a href="mailto:' + encodeURIComponent(item.email) + '">' + escapeHtml(item.email || '—') + '</a></div>' +
        '<div><small>Phone</small><a href="tel:' + encodeURIComponent(item.phone) + '">' + escapeHtml(item.phone || '—') + '</a></div>' +
        '<div><small>Experience</small><strong>' + applicationValue(item.yearsOfExperience, ' years') + '</strong></div>' +
        '<div><small>Expected</small><strong>' + salaryLabel(item) + '</strong></div>' +
        '<div><small>Notice</small><strong>' + escapeHtml(noticeLabel(item)) + '</strong></div>' +
        '</div></article>';
    }).join('');
  }

  async function updateApplicationStatus(select) {
    var card = select.closest('[data-application-id]');
    if (!card) return;
    select.disabled = true;
    try {
      var result = await api('/api/admin/applications/' + encodeURIComponent(card.dataset.applicationId), { method: 'PUT', body: JSON.stringify({ status: select.value }) });
      state.applications = result.applications || state.applications;
      renderApplications();
      toast('Application status updated.');
    } catch (error) {
      toast(error.message, true);
      renderApplications();
    }
  }

  function defaultPipelineClient() {
    return {
      stage: 'phone_screen',
      phoneScreen: 'pending',
      pathway: null,
      task: { title: '', notes: '', status: 'sent', decision: 'pending' },
      interviews: [],
      offer: { status: 'none', declinedReason: '' },
      history: []
    };
  }

  function pipelineOf(item) {
    return item && item.pipeline && typeof item.pipeline === 'object'
      ? item.pipeline
      : defaultPipelineClient();
  }

  function pipelineStageLabel(stage) {
    return ({
      phone_screen: 'Phone screen',
      task: 'Task',
      interview: 'Interviews',
      offer: 'Offer',
      closed: 'Closed',
      new: 'New'
    })[stage] || stage || 'Phone screen';
  }

  function phoneScreenLabel(value) {
    return ({
      pending: 'Pending',
      accepted: 'Accepted',
      rejected: 'Rejected',
      shortlisted: 'Shortlisted',
      requirements_not_met: 'Requirements not met'
    })[value] || value || 'Pending';
  }

  function isPipelineClosed(item) {
    var pipe = pipelineOf(item);
    if (pipe.stage === 'closed') return true;
    if (pipe.phoneScreen === 'rejected' || pipe.phoneScreen === 'requirements_not_met') return true;
    if (pipe.task && pipe.task.decision === 'rejected') return true;
    if (pipe.offer && (pipe.offer.status === 'joined' || pipe.offer.status === 'declined')) return true;
    return false;
  }

  function pipelineOutcomeLabel(item) {
    var pipe = pipelineOf(item);
    if (pipe.offer && pipe.offer.status === 'joined') return 'Joined';
    if (pipe.offer && pipe.offer.status === 'declined') return 'Declined';
    if (pipe.phoneScreen === 'rejected') return 'Rejected';
    if (pipe.phoneScreen === 'requirements_not_met') return 'Requirements not met';
    if (pipe.task && pipe.task.decision === 'rejected') return 'Task rejected';
    if (pipe.stage === 'closed') return 'Closed';
    return pipelineStageLabel(pipe.stage);
  }

  function applicationMatchesOpenJob(item, job) {
    if (!item || !job) return false;
    var title = String(job.title || '');
    var href = String(job.href || '');
    var hrefSlug = href.split('/').pop().replace(/\.[^.]+$/, '');
    var roleSlug = String(item.roleSlug || '');
    return Boolean((title && item.role === title) || (hrefSlug && roleSlug && hrefSlug === roleSlug));
  }

  function hasOpenVacancy(item) {
    var jobs = (((state.data || {}).collections || {}).jobs) || [];
    return jobs.some(function (job) {
      return job.status === 'published' && applicationMatchesOpenJob(item, job);
    });
  }

  function isInHiringProcess(item) {
    return Boolean(
      item &&
      item.pipeline &&
      typeof item.pipeline === 'object' &&
      !isPipelineClosed(item)
    );
  }

  function openHrPipeline(applicationId, options) {
    options = options || {};
    var item = (state.applications || []).find(function (entry) { return entry.id === applicationId; });
    if (!item) {
      toast('Candidate not found.', true);
      return;
    }

    function enterPipeline(target) {
      state.hrSelectedId = target.id;
      state.hrRole = target.role || 'all';
      switchView('hrPortal');
    }

    if (isInHiringProcess(item)) {
      enterPipeline(item);
      return;
    }

    if (item.pipeline && isPipelineClosed(item)) {
      toast('This candidate is closed. Review them in Analytics & History.', true);
      switchView('hrAnalytics');
      return;
    }

    if (!hasOpenVacancy(item)) {
      toast('This vacancy is closed. You can only start new pipelines on open roles.', true);
      return;
    }

    if (!options.enroll) {
      toast('Start this candidate from Applications first.', true);
      switchView('applications');
      return;
    }

    api('/api/admin/applications/' + encodeURIComponent(item.id) + '/pipeline', {
      method: 'PUT',
      body: JSON.stringify({
        phoneScreen: 'pending',
        pathway: null,
        task: { title: '', notes: '', status: 'sent', decision: 'pending' },
        interviews: [],
        offer: { status: 'none', declinedReason: '' },
        action: 'start'
      })
    }).then(function (result) {
      state.applications = result.applications || state.applications;
      var updated = result.application || (state.applications || []).find(function (entry) { return entry.id === item.id; });
      if (!updated) {
        toast('Could not start the hiring pipeline.', true);
        return;
      }
      toast('Candidate added to Active Hiring Process.');
      enterPipeline(updated);
      renderApplications();
      renderDashboard();
    }).catch(function (error) {
      toast(error.message || 'Could not start the hiring pipeline.', true);
    });
  }

  var INTERVIEW_TYPE_OPTIONS = ['HR', 'Tech', 'CEO', 'CTO', 'Marketing', 'Sales', 'AI & Data'];
  var INTERVIEW_FORMAT_OPTIONS = [['online', 'Online'], ['onsite', 'Onsite']];

  function interviewFormatLabel(value) {
    return ({ online: 'Online', onsite: 'Onsite' })[value] || 'Online';
  }

  function interviewFormatOf(entry) {
    return entry && entry.format === 'onsite' ? 'onsite' : 'online';
  }

  function jobStagesForApplication(item) {
    var jobs = (((state.data || {}).collections || {}).jobs) || [];
    var slug = String((item && item.roleSlug) || '');
    var title = String((item && item.role) || '');
    var job = jobs.find(function (entry) {
      var href = String(entry.href || '');
      var hrefSlug = href.split('/').pop().replace(/\.[^.]+$/, '');
      return (slug && hrefSlug === slug) || (title && entry.title === title);
    });
    var stages = Array.isArray(job && job.interviewStages) ? job.interviewStages.filter(Boolean) : [];
    var allowed = stages.filter(function (label) { return INTERVIEW_TYPE_OPTIONS.indexOf(label) > -1; });
    return allowed.length ? allowed : INTERVIEW_TYPE_OPTIONS.slice();
  }

  function interviewLabelFromRow(row) {
    var type = (($('[name="interviewType"]', row) || {}).value || '').trim();
    if (type === '__custom__') {
      return (($('[name="interviewLabel"]', row) || {}).value || '').trim() || 'Custom';
    }
    return type || (($('[name="interviewLabel"]', row) || {}).value || '').trim() || 'HR';
  }

  function interviewIsEnded(entry) {
    var result = entry && entry.result;
    return result === 'pass' || result === 'fail';
  }

  function nextInterviewLabel(existing, item) {
    var used = (existing || []).map(function (entry) { return entry.label; });
    var stages = jobStagesForApplication(item);
    var next = stages.find(function (label) { return used.indexOf(label) === -1; });
    return next || 'HR';
  }

  function canAddNextInterview(interviews) {
    if (!(interviews || []).length) return true;
    return interviewIsEnded(interviews[interviews.length - 1]);
  }

  function isOpenInterview(entry) {
    if (!entry) return true;
    var hasScore = entry.score != null && entry.score !== '';
    return !(entry.interviewer || '').trim() &&
      !(entry.interviewerUserId || '').trim() &&
      !(entry.scheduledAt || '').trim() &&
      !(entry.notes || '').trim() &&
      !hasScore &&
      (!entry.result || entry.result === 'pending');
  }

  function limitInterviewRounds(list) {
    var raw = (list || []).slice();
    if (!raw.length) return raw;
    var kept = [];
    var openKept = false;
    raw.forEach(function (entry) {
      if (!isOpenInterview(entry)) {
        kept.push(entry);
        openKept = false;
      } else if (!openKept) {
        kept.push(entry);
        openKept = true;
      }
    });
    return kept.length ? kept : raw.slice(0, 1);
  }

  function addInterviewButtonHtml(canAdd) {
    if (canAdd) {
      return '<div class="hr-add-interview" data-add-interview-wrap><button class="secondary-btn" type="button" data-add-interview><i class="ti ti-plus"></i> Add next interview</button></div>';
    }
    return '<div class="hr-add-interview is-locked" data-add-interview-wrap><span>Set result to Pass or Fail to unlock the next interview.</span></div>';
  }

  function refreshAddInterviewControl() {
    var wrap = $('[data-add-interview-wrap]', $('#hrPipelineDetail'));
    if (!wrap) return;
    var rows = $$('[data-interview-row]', $('#hrPipelineDetail'));
    var last = rows[rows.length - 1];
    var ended = !last || interviewIsEnded({ result: ($('[name="result"]', last) || {}).value });
    wrap.outerHTML = addInterviewButtonHtml(ended);
  }

  function interviewerOptionsHtml(selectedId) {
    var selected = String(selectedId || '');
    var options = '<option value="">Select staff interviewer</option>' +
      (state.staffInterviewers || []).map(function (person) {
        return '<option value="' + escapeHtml(person.id) + '"' + (person.id === selected ? ' selected' : '') + '>' +
          escapeHtml(person.name) + ' · ' + escapeHtml(person.email) +
          '</option>';
      }).join('');
    if (selected && !(state.staffInterviewers || []).some(function (person) { return person.id === selected; })) {
      options += '<option value="' + escapeHtml(selected) + '" selected>Previous interviewer (update required)</option>';
    }
    return options;
  }

  function interviewRowHtml(entry, index) {
    var label = entry.label || 'HR';
    var isCustom = INTERVIEW_TYPE_OPTIONS.indexOf(label) === -1;
    var typeValue = isCustom ? '__custom__' : label;
    var result = entry.result || 'pending';
    var typeOptions = INTERVIEW_TYPE_OPTIONS.map(function (option) {
      return '<option value="' + option + '"' + (option === typeValue ? ' selected' : '') + '>' + option + '</option>';
    }).join('') + '<option value="__custom__"' + (isCustom ? ' selected' : '') + '>Custom</option>';
    var resultOptions = [['pending', 'Pending'], ['pass', 'Pass'], ['fail', 'Fail']].map(function (option) {
      return '<option value="' + option[0] + '"' + (option[0] === result ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('');
    var scheduled = entry.scheduledAt ? String(entry.scheduledAt).slice(0, 16) : '';
    var scoreVal = entry.score == null ? '' : entry.score;
    var format = interviewFormatOf(entry);
    var formatOptions = INTERVIEW_FORMAT_OPTIONS.map(function (option) {
      return '<option value="' + option[0] + '"' + (option[0] === format ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('');
    return '<article class="hr-interview-card" data-interview-row data-interview-id="' + escapeHtml(entry.id || '') + '" data-result="' + escapeHtml(result) + '">' +
      '<div class="hr-interview-toolbar">' +
      '<strong>Round ' + (index + 1) + '</strong>' +
      '<select name="result" class="hr-result-select is-' + escapeHtml(result) + '" aria-label="Interview result">' + resultOptions + '</select>' +
      '<button class="icon-btn hr-interview-remove" type="button" data-remove-interview aria-label="Remove interview"><i class="ti ti-trash"></i></button>' +
      '</div>' +
      '<div class="hr-interview-grid">' +
      '<label><span>Stage</span><select name="interviewType">' + typeOptions + '</select></label>' +
      '<label class="hr-custom-label' + (isCustom ? '' : ' is-hidden') + '" data-custom-label><span>Custom name</span><input name="interviewLabel" type="text" value="' + escapeHtml(isCustom ? label : '') + '" placeholder="e.g. Culture fit"></label>' +
      '<label><span>Interview type</span><select name="interviewFormat">' + formatOptions + '</select></label>' +
      '<label><span>Interviewer</span><select name="interviewerUserId">' + interviewerOptionsHtml(entry.interviewerUserId) + '</select></label>' +
      '<label><span>When</span><input name="scheduledAt" type="datetime-local" value="' + escapeHtml(scheduled) + '"></label>' +
      '<label class="hr-score-field"><span>Score <em>0–10</em></span><input name="score" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="' + escapeHtml(scoreVal) + '" placeholder="e.g. 7.5"><small class="hr-score-hint">Required for Pass / Fail · half points allowed</small></label>' +
      '<label class="hr-span-2"><span>Notes</span><textarea name="notes" rows="2" placeholder="Feedback">' + escapeHtml(entry.notes || '') + '</textarea></label>' +
      '</div></article>';
  }

  function collectPipelineFromForm(root) {
    var phoneScreen = ($('[name="phoneScreen"]', root) || {}).value || 'pending';
    var pathway = null;
    var pathwayInput = $('input[name="pathway"]:checked', root);
    if (phoneScreen === 'accepted' && pathwayInput) pathway = pathwayInput.value;
    var task = {
      title: (($('[name="taskTitle"]', root) || {}).value || '').trim(),
      notes: (($('[name="taskNotes"]', root) || {}).value || '').trim(),
      status: ($('[name="taskStatus"]', root) || {}).value || 'sent',
      decision: ($('[name="taskDecision"]', root) || {}).value || 'pending'
    };
    var interviews = $$('[data-interview-row]', root).map(function (row) {
      var interviewerUserId = (($('[name="interviewerUserId"]', row) || {}).value || '').trim();
      var staff = (state.staffInterviewers || []).find(function (person) { return person.id === interviewerUserId; });
      return {
        id: row.dataset.interviewId || '',
        label: interviewLabelFromRow(row),
        format: (($('[name="interviewFormat"]', row) || {}).value || 'online').trim(),
        interviewerUserId: interviewerUserId,
        interviewer: staff ? staff.name : '',
        interviewerEmail: staff ? staff.email : '',
        scheduledAt: (($('[name="scheduledAt"]', row) || {}).value || '').trim(),
        score: (($('[name="score"]', row) || {}).value || '').trim(),
        notes: (($('[name="notes"]', row) || {}).value || '').trim(),
        result: ($('[name="result"]', row) || {}).value || 'pending'
      };
    });
    var offerStatus = ($('[name="offerStatus"]', root) || {}).value || 'none';
    return {
      phoneScreen: phoneScreen,
      pathway: pathway,
      task: task,
      interviews: interviews,
      offer: {
        status: offerStatus,
        declinedReason: (($('[name="declinedReason"]', root) || {}).value || '').trim()
      },
      action: 'update'
    };
  }

  function validateInterviewSchedule(interviews, form) {
    var list = interviews || [];
    for (var i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (!entry.scheduledAt) continue;
      if (entry.interviewerUserId) continue;
      var row = form ? $$('[data-interview-row]', form)[i] : null;
      var select = row ? $('[name="interviewerUserId"]', row) : null;
      if (select) {
        select.classList.add('is-invalid');
        select.focus();
      }
      return 'Round ' + (i + 1) + ': pick a staff interviewer before scheduling.';
    }
    return '';
  }

  function parseInterviewScore(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return { empty: true, value: null };
    var num = Number(raw);
    if (!Number.isFinite(num)) return { empty: false, invalid: true, value: null };
    if (num < 0 || num > 10) return { empty: false, invalid: true, value: null, outOfRange: true };
    if (Math.round(num * 2) !== num * 2) return { empty: false, invalid: true, value: null, step: true };
    return { empty: false, invalid: false, value: Math.round(num * 10) / 10 };
  }

  function validateInterviewScores(interviews, form) {
    var list = interviews || [];
    for (var i = 0; i < list.length; i += 1) {
      var entry = list[i];
      var row = form ? $$('[data-interview-row]', form)[i] : null;
      var scoreInput = row ? $('[name="score"]', row) : null;
      if (scoreInput) scoreInput.classList.remove('is-invalid');
      var parsed = parseInterviewScore(entry.score);
      var result = entry.result || 'pending';
      var round = 'Round ' + (i + 1);
      var label = entry.label ? ' (' + entry.label + ')' : '';
      if (parsed.invalid) {
        if (scoreInput) {
          scoreInput.classList.add('is-invalid');
          scoreInput.focus();
        }
        if (parsed.step) return round + label + ': score must use half points (e.g. 7 or 7.5).';
        return round + label + ': score must be a number between 0 and 10.';
      }
      if ((result === 'pass' || result === 'fail') && parsed.empty) {
        if (scoreInput) {
          scoreInput.classList.add('is-invalid');
          scoreInput.focus();
        }
        return round + label + ': add a score (0–10) before marking Pass or Fail.';
      }
    }
    return '';
  }

  function markInterviewScoreValidity(input) {
    if (!input) return;
    var parsed = parseInterviewScore(input.value);
    input.classList.toggle('is-invalid', Boolean(parsed.invalid));
  }

  function renderHrPipelineDetail(item) {
    var detail = $('#hrPipelineDetail');
    var prompt = $('#hrCandidatePrompt');
    if (!detail || !prompt) return;
    if (!item) {
      prompt.classList.remove('is-hidden');
      detail.classList.add('is-hidden');
      detail.innerHTML = '';
      return;
    }
    prompt.classList.add('is-hidden');
    detail.classList.remove('is-hidden');
    var pipe = pipelineOf(item);
    var phone = pipe.phoneScreen || 'pending';
    var accepted = phone === 'accepted';
    var pathway = pipe.pathway || '';
    var showTask = accepted && pathway === 'with_tasks';
    var taskDecision = (pipe.task && pipe.task.decision) || 'pending';
    var taskApproved = taskDecision === 'approved';
    var showInterviews = accepted && Boolean(pathway) && (pathway !== 'with_tasks' || taskApproved);
    var showOffer = showInterviews;
    var steps = [
      ['phone_screen', 'Phone'],
      ['task', 'Task'],
      ['interview', 'Interview'],
      ['offer', 'Offer'],
      ['closed', 'Done']
    ];
    var stage = pipe.stage || 'phone_screen';
    var order = ['phone_screen', 'task', 'interview', 'offer', 'closed'];
    var stageIndex = order.indexOf(stage);
    var stepper = steps.map(function (step) {
      if (pathway === 'no_tasks' && step[0] === 'task') return '';
      var active = step[0] === stage;
      var done = stageIndex > order.indexOf(step[0]);
      return '<div class="hr-step' + (active ? ' is-active' : '') + (done ? ' is-done' : '') + '"><i></i><span>' + escapeHtml(step[1]) + '</span></div>';
    }).join('');

    var phoneOptions = [
      ['pending', 'Pending'],
      ['accepted', 'Accepted'],
      ['rejected', 'Rejected'],
      ['shortlisted', 'Shortlisted'],
      ['requirements_not_met', 'Requirements not met']
    ].map(function (option) {
      return '<option value="' + option[0] + '"' + (option[0] === phone ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('');

    var interviews = limitInterviewRounds((pipe.interviews || []).slice());
    if (showInterviews && !interviews.length) {
      interviews = [{
        id: '',
        label: nextInterviewLabel([], item),
        format: 'online',
        interviewer: '',
        interviewerUserId: '',
        scheduledAt: '',
        score: '',
        notes: '',
        result: 'pending'
      }];
    }
    var interviewHtml = interviews.map(function (entry, index) {
      return interviewRowHtml(entry, index);
    }).join('');
    var canAddInterview = canAddNextInterview(interviews);

    var offerStatus = (pipe.offer && pipe.offer.status) || 'none';
    var offerOptions = [['none', 'Not started'], ['sent', 'Job offer sent'], ['joined', 'Joined'], ['declined', 'Declined']].map(function (option) {
      return '<option value="' + option[0] + '"' + (option[0] === offerStatus ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('');

    var stepPhone = 1;
    var stepPathway = accepted ? 2 : 0;
    var stepTask = showTask ? 3 : 0;
    var stepInterview = showInterviews ? (showTask ? 4 : 3) : 0;
    var stepOffer = showOffer ? (showTask ? 5 : 4) : 0;

    detail.innerHTML =
      '<button class="back-dashboard hr-detail-close" type="button" data-hr-back-list><i class="ti ti-x"></i> Close</button>' +
      '<header class="hr-detail-head">' +
      '<div class="hr-detail-identity">' +
      '<span class="hr-detail-avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span>' +
      '<div><span class="application-role">' + escapeHtml(item.role) + '</span>' +
      '<h2>' + escapeHtml(item.fullName) + '</h2>' +
      '<p><span class="hr-stage-pill">' + escapeHtml(pipelineStageLabel(stage)) + '</span> ' + escapeHtml(phoneScreenLabel(phone)) + '</p></div></div>' +
      '<div class="hr-detail-actions"><a class="secondary-btn" href="' + escapeHtml(item.linkedin || '#') + '" target="_blank" rel="noopener"><i class="ti ti-brand-linkedin"></i> LinkedIn</a>' +
      '<a class="primary-btn" href="/api/admin/applications/' + encodeURIComponent(item.id) + '/resume"><i class="ti ti-download"></i> CV</a>' +
      (offerStatus === 'joined'
        ? '<button class="secondary-btn" type="button" data-start-onboarding="' + escapeHtml(item.id) + '"><i class="ti ti-user-plus"></i> Start onboarding</button>'
        : '') +
      '</div></header>' +
      '<nav class="hr-stepper" aria-label="Pipeline progress">' + stepper + '</nav>' +
      '<ul class="hr-meta">' +
      '<li><span>Email</span><a href="mailto:' + encodeURIComponent(item.email) + '" title="' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a></li>' +
      '<li><span>Phone</span><a href="tel:' + encodeURIComponent(item.phone) + '">' + escapeHtml(item.phone) + '</a></li>' +
      '<li><span>Experience</span><strong>' + applicationValue(item.yearsOfExperience, ' years') + '</strong></li>' +
      '<li><span>Salary</span><strong>' + salaryLabel(item) + '</strong></li>' +
      '</ul>' +
      '<form class="hr-pipeline-form" id="hrPipelineForm">' +
      '<ol class="hr-flow">' +
      '<li class="hr-flow-step' + (stage === 'phone_screen' ? ' is-current' : '') + (accepted ? ' is-complete' : '') + '">' +
      '<div class="hr-flow-marker"><b>' + stepPhone + '</b></div>' +
      '<div class="hr-flow-body">' +
      '<div class="hr-flow-title"><h3>Phone screening</h3></div>' +
      '<label class="hr-field"><span>Outcome</span><select name="phoneScreen">' + phoneOptions + '</select></label>' +
      '</div></li>' +
      (accepted
        ? '<li class="hr-flow-step' + (!pathway ? ' is-current' : ' is-complete') + '">' +
          '<div class="hr-flow-marker"><b>' + stepPathway + '</b></div>' +
          '<div class="hr-flow-body">' +
          '<div class="hr-flow-title"><h3>Pathway</h3><p>Choose the next move for this candidate</p></div>' +
          '<div class="hr-segment" role="radiogroup" aria-label="Hiring pathway">' +
          '<label class="hr-segment__option">' +
          '<input type="radio" name="pathway" value="with_tasks"' + (pathway === 'with_tasks' ? ' checked' : '') + '>' +
          '<span><strong>With tasks</strong><em>Assignment first, then interviews</em></span></label>' +
          '<label class="hr-segment__option">' +
          '<input type="radio" name="pathway" value="no_tasks"' + (pathway === 'no_tasks' ? ' checked' : '') + '>' +
          '<span><strong>No tasks</strong><em>Straight to interviews</em></span></label>' +
          '</div></div></li>'
        : '') +
      (showTask
        ? '<li class="hr-flow-step' + (stage === 'task' ? ' is-current' : '') + (taskApproved ? ' is-complete' : '') + (taskDecision === 'rejected' ? ' is-rejected' : '') + '">' +
          '<div class="hr-flow-marker"><b>' + stepTask + '</b></div>' +
          '<div class="hr-flow-body">' +
          '<div class="hr-flow-title"><h3>Task</h3><p>Review the assignment, then approve or reject</p></div>' +
          '<div class="hr-fields-2">' +
          '<label class="hr-field"><span>Title</span><input name="taskTitle" type="text" value="' + escapeHtml((pipe.task && pipe.task.title) || '') + '" placeholder="Take-home assignment" required></label>' +
          '<label class="hr-field"><span>Status</span><select name="taskStatus">' +
          [['sent', 'Sent'], ['in_progress', 'In progress'], ['done', 'Done']].map(function (option) {
            return '<option value="' + option[0] + '"' + (option[0] === ((pipe.task && pipe.task.status) || 'sent') ? ' selected' : '') + '>' + option[1] + '</option>';
          }).join('') +
          '</select></label>' +
          '<label class="hr-field hr-span-2"><span>Notes</span><textarea name="taskNotes" rows="2" placeholder="Instructions or notes">' + escapeHtml((pipe.task && pipe.task.notes) || '') + '</textarea></label>' +
          '</div>' +
          '<input type="hidden" name="taskDecision" value="' + escapeHtml(taskDecision) + '">' +
          '<div class="hr-task-decision" role="group" aria-label="Task decision">' +
          '<button class="hr-decision-btn is-approve' + (taskDecision === 'approved' ? ' is-active' : '') + '" type="button" data-task-decision="approved"><i class="ti ti-check"></i> Approve</button>' +
          '<button class="hr-decision-btn is-reject' + (taskDecision === 'rejected' ? ' is-active' : '') + '" type="button" data-task-decision="rejected"><i class="ti ti-x"></i> Reject</button>' +
          '</div>' +
          (taskDecision === 'approved' ? '<p class="hr-decision-note is-approve">Task approved — interviews unlocked.</p>' : '') +
          (taskDecision === 'rejected' ? '<p class="hr-decision-note is-reject">Task rejected — pipeline closed.</p>' : '') +
          '</div></li>'
        : '') +
      (showInterviews
        ? '<li class="hr-flow-step' + (stage === 'interview' ? ' is-current' : '') + '">' +
          '<div class="hr-flow-marker"><b>' + stepInterview + '</b></div>' +
          '<div class="hr-flow-body">' +
          '<div class="hr-flow-title"><h3>Interviews</h3><p>Only one round at a time. Finish it, then use Add next interview.</p></div>' +
          '<div class="hr-interview-list" data-interview-list>' + (interviewHtml || '') + '</div>' +
          addInterviewButtonHtml(canAddInterview) +
          '</div></li>'
        : '') +
      (showOffer
        ? '<li class="hr-flow-step' + (stage === 'offer' ? ' is-current' : '') + '">' +
          '<div class="hr-flow-marker"><b>' + stepOffer + '</b></div>' +
          '<div class="hr-flow-body">' +
          '<div class="hr-flow-title"><h3>Offer</h3></div>' +
          '<div class="hr-fields-2">' +
          '<label class="hr-field"><span>Outcome</span><select name="offerStatus">' + offerOptions + '</select></label>' +
          '<label class="hr-field hr-span-2' + (offerStatus === 'declined' ? '' : ' is-hidden') + '" data-decline-wrap><span>Decline reason</span><textarea name="declinedReason" rows="2" placeholder="Required if declined">' + escapeHtml((pipe.offer && pipe.offer.declinedReason) || '') + '</textarea></label>' +
          '</div></div></li>'
        : '') +
      '</ol>' +
      '<div class="hr-save-row"><button class="primary-btn" type="submit"><i class="ti ti-device-floppy"></i> Save pipeline</button></div>' +
      '</form>';
  }


  function pipelineStageKey(item) {
    var pipe = pipelineOf(item);
    if (isPipelineClosed(item)) return 'closed';
    return pipe.stage || 'phone_screen';
  }

  function parseDateValue(value) {
    if (!value) return null;
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function daysBetween(start, end) {
    if (!start || !end) return null;
    var ms = end.getTime() - start.getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.round(ms / 86400000);
  }

  function isHrInterviewRound(entry) {
    return String((entry && entry.label) || '').trim().toLowerCase() === 'hr';
  }

  function interviewHasActivity(entry) {
    if (!entry) return false;
    if (entry.result === 'pass' || entry.result === 'fail') return true;
    if ((entry.interviewer || '').trim()) return true;
    if ((entry.scheduledAt || '').trim()) return true;
    if ((entry.notes || '').trim()) return true;
    if (entry.score != null && entry.score !== '') return true;
    return false;
  }

  function interviewConductedCount(item) {
    var interviews = (pipelineOf(item).interviews || []);
    return interviews.filter(function (entry) {
      return isHrInterviewRound(entry) && interviewHasActivity(entry);
    }).length;
  }

  function candidateClosedAt(item) {
    var pipe = pipelineOf(item);
    var history = Array.isArray(pipe.history) ? pipe.history : [];
    if (history.length) {
      var stamp = parseDateValue(history[0].at);
      if (stamp) return stamp;
    }
    return parseDateValue(item.updatedAt) || parseDateValue(item.submittedAt);
  }

  function candidateHireAt(item) {
    var pipe = pipelineOf(item);
    if (!(pipe.offer && pipe.offer.status === 'joined')) return null;
    var history = Array.isArray(pipe.history) ? pipe.history : [];
    var joinedEntry = history.find(function (entry) {
      var detail = String((entry && entry.detail) || '').toLowerCase();
      var action = String((entry && entry.action) || '').toLowerCase();
      return detail.indexOf('joined') > -1 || action.indexOf('joined') > -1 || detail.indexOf('offer') > -1;
    });
    if (joinedEntry) {
      var stamp = parseDateValue(joinedEntry.at);
      if (stamp) return stamp;
    }
    return candidateClosedAt(item);
  }

  function candidateOutcome(item) {
    var pipe = pipelineOf(item);
    if (pipe.offer && pipe.offer.status === 'joined') return 'accepted';
    if (pipe.phoneScreen === 'rejected' || pipe.phoneScreen === 'requirements_not_met') return 'rejected';
    if (pipe.task && pipe.task.decision === 'rejected') return 'rejected';
    if (pipe.offer && pipe.offer.status === 'declined') return 'rejected';
    if (pipe.stage === 'closed') return 'rejected';
    var interviews = pipe.interviews || [];
    if (interviews.length && interviews.every(function (entry) { return entry.result === 'pass' || entry.result === 'fail'; }) && interviews.some(function (entry) { return entry.result === 'fail'; })) {
      return 'rejected';
    }
    return null;
  }

  function inAnalyticsRange(date) {
    if (!date) return false;
    var from = state.analyticsFrom ? startOfDay(parseDateValue(state.analyticsFrom)) : null;
    var to = state.analyticsTo ? endOfDay(parseDateValue(state.analyticsTo)) : null;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function analyticsCandidateRows(list) {
    return list.map(function (item) {
      var closedAt = candidateClosedAt(item);
      var hireAt = candidateHireAt(item);
      var submittedAt = parseDateValue(item.submittedAt);
      var tth = hireAt && submittedAt ? daysBetween(submittedAt, hireAt) : null;
      return {
        item: item,
        outcome: candidateOutcome(item),
        closedAt: closedAt,
        hireAt: hireAt,
        timeToHireDays: tth,
        interviews: interviewConductedCount(item)
      };
    }).filter(function (row) {
      if (!row.outcome) return false;
      if (state.analyticsOutcome === 'accepted' && row.outcome !== 'accepted') return false;
      if (state.analyticsOutcome === 'rejected' && row.outcome !== 'rejected') return false;
      return inAnalyticsRange(row.closedAt || row.hireAt || parseDateValue(row.item.submittedAt));
    });
  }

  var ANALYTICS_PAGE_SIZE = 25;

  function analyticsPeopleRowHtml(row, mode) {
    var item = row.item;
    var when = mode === 'accepted'
      ? (row.timeToHireDays == null ? '—' : row.timeToHireDays + 'd')
      : (row.closedAt ? formatDate(row.closedAt.toISOString(), true) : '—');
    var onboardingBtn = mode === 'accepted'
      ? '<button class="text-btn" type="button" data-start-onboarding="' + escapeHtml(item.id) + '"><i class="ti ti-user-plus"></i> Onboard</button>'
      : '';
    return '<tr>' +
      '<td><div class="hr-table-person"><span class="application-avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span><div><strong>' + escapeHtml(item.fullName) + '</strong><small>' + escapeHtml(item.email || '') + '</small></div></div></td>' +
      '<td>' + escapeHtml(item.role || '—') + '</td>' +
      '<td><span class="pipeline-chip' + (row.outcome === 'rejected' ? ' is-closed' : '') + '">' + escapeHtml(pipelineOutcomeLabel(item)) + '</span></td>' +
      '<td>' + row.interviews + '</td>' +
      '<td>' + escapeHtml(String(when)) + '</td>' +
      '<td>' + onboardingBtn + '</td>' +
      '</tr>';
  }

  function renderAnalyticsPeopleTable(rows, emptyId, listId, mode, shownCount) {
    var list = $(listId);
    var empty = $(emptyId);
    if (!list || !empty) return 0;
    var hasRows = rows.length > 0;
    empty.classList.toggle('is-hidden', hasRows);
    list.classList.toggle('is-hidden', !hasRows);
    if (!hasRows) {
      list.innerHTML = '';
      return 0;
    }
    var visible = Math.min(shownCount || ANALYTICS_PAGE_SIZE, rows.length);
    var slice = rows.slice(0, visible);
    list.innerHTML =
      '<div class="analytics-scroll" data-analytics-scroll="' + escapeHtml(mode) + '">' +
      '<table class="hr-table analytics-table"><thead><tr>' +
      '<th>Candidate</th><th>Role</th><th>Outcome</th><th>Interviews</th><th>' + (mode === 'accepted' ? 'Time to hire' : 'Closed') + '</th><th></th>' +
      '</tr></thead><tbody data-analytics-body="' + escapeHtml(mode) + '">' +
      slice.map(function (row) { return analyticsPeopleRowHtml(row, mode); }).join('') +
      '</tbody></table></div>' +
      '<div class="analytics-scroll-meta" data-analytics-meta="' + escapeHtml(mode) + '">Showing ' + visible + ' of ' + rows.length +
      (visible < rows.length ? ' · Scroll for more' : '') + '</div>';
    return visible;
  }

  function appendAnalyticsPeopleRows(mode) {
    var isAccepted = mode === 'accepted';
    var rows = isAccepted ? state.analyticsAcceptedRows : state.analyticsRejectedRows;
    var shown = isAccepted ? state.analyticsAcceptedShown : state.analyticsRejectedShown;
    if (shown >= rows.length) return;
    var next = Math.min(shown + ANALYTICS_PAGE_SIZE, rows.length);
    var body = $('[data-analytics-body="' + mode + '"]');
    var meta = $('[data-analytics-meta="' + mode + '"]');
    if (!body) return;
    var html = rows.slice(shown, next).map(function (row) { return analyticsPeopleRowHtml(row, mode); }).join('');
    body.insertAdjacentHTML('beforeend', html);
    if (isAccepted) state.analyticsAcceptedShown = next;
    else state.analyticsRejectedShown = next;
    if (meta) {
      meta.textContent = 'Showing ' + next + ' of ' + rows.length + (next < rows.length ? ' · Scroll for more' : '');
    }
  }

  function closedVacancyAnalytics(rows) {
    var jobs = (((state.data || {}).collections || {}).jobs) || [];
    var byRole = {};
    rows.forEach(function (row) {
      var key = row.item.roleSlug || row.item.role || 'unknown';
      if (!byRole[key]) {
        byRole[key] = {
          key: key,
          title: row.item.role || key,
          interviews: 0,
          hired: 0,
          rejected: 0,
          hireDays: []
        };
      }
      byRole[key].interviews += row.interviews;
      if (row.outcome === 'accepted') {
        byRole[key].hired += 1;
        if (row.timeToHireDays != null) byRole[key].hireDays.push(row.timeToHireDays);
      } else {
        byRole[key].rejected += 1;
      }
    });

    jobs.forEach(function (job) {
      if (job.status === 'published') return;
      var slug = pathBasename(job.href || '');
      var key = slug || job.title || job.id;
      if (!byRole[key]) {
        byRole[key] = {
          key: key,
          title: job.title || key,
          interviews: 0,
          hired: 0,
          rejected: 0,
          hireDays: [],
          unpublished: true
        };
      } else {
        byRole[key].unpublished = true;
        byRole[key].title = job.title || byRole[key].title;
      }
    });

    return Object.keys(byRole).map(function (key) { return byRole[key]; }).filter(function (entry) {
      return entry.hired > 0 || entry.rejected > 0 || entry.unpublished;
    }).map(function (entry) {
      var avg = entry.hireDays.length
        ? Math.round(entry.hireDays.reduce(function (sum, value) { return sum + value; }, 0) / entry.hireDays.length)
        : null;
      return Object.assign({}, entry, { avgTimeToHire: avg });
    }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
  }

  function pathBasename(href) {
    var clean = String(href || '').split(/[?#]/)[0];
    var part = clean.split('/').pop() || '';
    return part.replace(/\.[^.]+$/, '');
  }

  function calendarDayKey(date) {
    if (!date) return '';
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function calendarMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function ensureCalendarState() {
    if (!(state.calendarMonth instanceof Date) || Number.isNaN(state.calendarMonth.getTime())) {
      state.calendarMonth = calendarMonthStart(new Date());
    }
    if (!state.calendarSelectedDay) state.calendarSelectedDay = calendarDayKey(new Date());
  }

  function collectScheduledInterviews() {
    var events = [];
    (state.applications || []).forEach(function (item) {
      var pipe = pipelineOf(item);
      (pipe.interviews || []).forEach(function (entry, index) {
        var when = parseDateValue(entry.scheduledAt);
        if (!when) return;
        events.push({
          applicationId: item.id,
          candidate: item.fullName || 'Candidate',
          role: item.role || '—',
          label: entry.label || ('Interview ' + (index + 1)),
          format: interviewFormatOf(entry),
          interviewer: entry.interviewer || '',
          result: entry.result || 'pending',
          at: when,
          dayKey: calendarDayKey(when)
        });
      });
    });
    return events.sort(function (a, b) { return a.at.getTime() - b.at.getTime(); });
  }

  function formatInterviewTime(date) {
    if (!date) return '';
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }
  }

  function interviewResultLabel(result) {
    return ({ pending: 'Pending', pass: 'Pass', fail: 'Fail' })[result] || result || 'Pending';
  }

  function renderHrCalendar() {
    ensureCalendarState();
    var month = state.calendarMonth;
    var events = collectScheduledInterviews();
    var byDay = {};
    events.forEach(function (event) {
      if (!byDay[event.dayKey]) byDay[event.dayKey] = [];
      byDay[event.dayKey].push(event);
    });

    var todayKey = calendarDayKey(new Date());
    var monthKeyPrefix = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0');
    var monthEvents = events.filter(function (event) { return event.dayKey.indexOf(monthKeyPrefix) === 0; });
    var todayEvents = byDay[todayKey] || [];
    var upcomingEvents = events.filter(function (event) { return event.dayKey > todayKey; });

    var monthLabel = $('#calendarMonthLabel');
    var monthMeta = $('#calendarMonthMeta');
    if (monthLabel) {
      try {
        monthLabel.textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      } catch (_) {
        monthLabel.textContent = (month.getMonth() + 1) + '/' + month.getFullYear();
      }
    }
    if (monthMeta) {
      monthMeta.textContent = monthEvents.length + (monthEvents.length === 1 ? ' interview this month' : ' interviews this month');
    }
    if ($('#calendarStatMonth')) $('#calendarStatMonth').textContent = monthEvents.length;
    if ($('#calendarStatToday')) $('#calendarStatToday').textContent = todayEvents.length;
    if ($('#calendarStatUpcoming')) $('#calendarStatUpcoming').textContent = upcomingEvents.length;

    var grid = $('#calendarGrid');
    if (grid) {
      var firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
      var startOffset = (firstDay.getDay() + 6) % 7;
      var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      var cells = [];
      var i;
      for (i = 0; i < startOffset; i += 1) cells.push('<div class="calendar-cell is-empty" aria-hidden="true"></div>');
      for (i = 1; i <= daysInMonth; i += 1) {
        var dayDate = new Date(month.getFullYear(), month.getMonth(), i);
        var key = calendarDayKey(dayDate);
        var dayEvents = byDay[key] || [];
        var classes = ['calendar-cell'];
        if (key === todayKey) classes.push('is-today');
        if (key === state.calendarSelectedDay) classes.push('is-selected');
        if (dayEvents.length) classes.push('has-events');
        var dots = '';
        if (dayEvents.length) {
          var toneCounts = { pending: 0, pass: 0, fail: 0 };
          dayEvents.forEach(function (event) {
            var tone = event.result === 'pass' || event.result === 'fail' ? event.result : 'pending';
            toneCounts[tone] += 1;
          });
          dots = '<span class="calendar-dots" aria-hidden="true">' +
            ['pending', 'pass', 'fail'].map(function (tone) {
              if (!toneCounts[tone]) return '';
              return '<i class="is-' + tone + '"></i>';
            }).join('') +
            '</span>';
        }
        cells.push(
          '<button class="' + classes.join(' ') + '" type="button" data-calendar-day="' + escapeHtml(key) + '" aria-pressed="' + (key === state.calendarSelectedDay) + '">' +
          '<span class="calendar-cell__day">' + i + '</span>' +
          (dayEvents.length ? '<span class="calendar-cell__count">' + dayEvents.length + '</span>' : '') +
          dots +
          (dayEvents.length
            ? '<span class="calendar-previews">' + dayEvents.slice(0, 2).map(function (event) {
                return '<span class="calendar-preview is-' + escapeHtml(event.result || 'pending') + '">' +
                  '<b>' + escapeHtml(formatInterviewTime(event.at)) + '</b> ' +
                  escapeHtml(event.candidate) +
                  '</span>';
              }).join('') +
              (dayEvents.length > 2 ? '<span class="calendar-more">+' + (dayEvents.length - 2) + ' more</span>' : '') +
              '</span>'
            : '') +
          '</button>'
        );
      }
      grid.innerHTML = cells.join('');
    }

    var selectedKey = state.calendarSelectedDay;
    var selectedEvents = byDay[selectedKey] || [];
    var agendaTitle = $('#calendarAgendaTitle');
    var agendaMeta = $('#calendarAgendaMeta');
    var agendaList = $('#calendarAgendaList');
    var agendaEmpty = $('#calendarAgendaEmpty');
    var selectedDate = parseDateValue(selectedKey + 'T12:00:00');
    if (agendaTitle) {
      try {
        agendaTitle.textContent = selectedDate
          ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
          : 'Selected day';
      } catch (_) {
        agendaTitle.textContent = selectedKey || 'Selected day';
      }
    }
    if (agendaMeta) {
      agendaMeta.textContent = selectedEvents.length
        ? selectedEvents.length + (selectedEvents.length === 1 ? ' interview scheduled' : ' interviews scheduled')
        : 'No interviews on this day';
    }
    if (agendaEmpty) agendaEmpty.classList.toggle('is-hidden', selectedEvents.length > 0);
    if (agendaList) {
      agendaList.classList.toggle('is-hidden', selectedEvents.length === 0);
      agendaList.innerHTML = selectedEvents.map(function (event) {
        var result = event.result || 'pending';
        var formatIcon = event.format === 'onsite' ? 'ti-map-pin' : 'ti-video';
        var badgeClass = result === 'pass' ? 'is-joined' : (result === 'fail' ? 'is-fail' : 'is-pipeline');
        return '<button class="calendar-event is-' + escapeHtml(result) + '" type="button" data-open-pipeline="' + escapeHtml(event.applicationId) + '">' +
          '<span class="calendar-event__time">' +
          '<strong>' + escapeHtml(formatInterviewTime(event.at)) + '</strong>' +
          '<small>' + escapeHtml(event.label || 'Interview') + '</small>' +
          '</span>' +
          '<span class="calendar-event__avatar">' + escapeHtml(applicationInitials(event.candidate)) + '</span>' +
          '<span class="calendar-event__copy">' +
          '<strong>' + escapeHtml(event.candidate) + '</strong>' +
          '<small>' + escapeHtml(event.role) + '</small>' +
          '<span class="calendar-event__meta">' +
          '<span><i class="ti ' + formatIcon + '"></i>' + escapeHtml(interviewFormatLabel(event.format)) + '</span>' +
          (event.interviewer ? '<span><i class="ti ti-user"></i>' + escapeHtml(event.interviewer) + '</span>' : '') +
          '</span>' +
          '</span>' +
          '<span class="calendar-event__aside">' +
          '<span class="app-badge ' + badgeClass + '">' + escapeHtml(interviewResultLabel(result)) + '</span>' +
          '<i class="ti ti-chevron-right" aria-hidden="true"></i>' +
          '</span>' +
          '</button>';
      }).join('');
    }
  }

  function interviewLogStatusKey(item) {
    var pipe = pipelineOf(item);
    if (pipe.offer && pipe.offer.status === 'joined') return 'joined';
    if (isPipelineClosed(item)) return 'closed';
    return 'active';
  }

  function collectInterviewLogProfiles() {
    return (state.applications || []).map(function (item) {
      var pipe = pipelineOf(item);
      var rounds = (pipe.interviews || []).filter(interviewHasActivity);
      if (!rounds.length) return null;
      var scores = rounds.map(function (entry) { return entry.score; }).filter(function (value) {
        return value != null && value !== '' && Number.isFinite(Number(value));
      }).map(Number);
      var avgScore = scores.length
        ? Math.round((scores.reduce(function (sum, value) { return sum + value; }, 0) / scores.length) * 10) / 10
        : null;
      var latestAt = null;
      rounds.forEach(function (entry) {
        var when = parseDateValue(entry.scheduledAt);
        if (when && (!latestAt || when > latestAt)) latestAt = when;
      });
      var passCount = rounds.filter(function (entry) { return entry.result === 'pass'; }).length;
      var failCount = rounds.filter(function (entry) { return entry.result === 'fail'; }).length;
      var pendingCount = rounds.filter(function (entry) { return !interviewIsEnded(entry); }).length;
      var conductedCount = rounds.filter(function (entry) {
        return interviewIsEnded(entry) || (entry.score != null && entry.score !== '') || (entry.notes || '').trim();
      }).length;
      var hasNotes = rounds.some(function (entry) { return (entry.notes || '').trim(); });
      var missingNotes = rounds.some(function (entry) { return !(entry.notes || '').trim(); });
      return {
        item: item,
        rounds: rounds,
        avgScore: avgScore,
        latestAt: latestAt,
        passCount: passCount,
        failCount: failCount,
        pendingCount: pendingCount,
        conductedCount: conductedCount,
        hasNotes: hasNotes,
        missingNotes: missingNotes,
        statusKey: interviewLogStatusKey(item),
        outcome: pipelineOutcomeLabel(item) || pipelineStageLabel(pipelineStageKey(item)),
      };
    }).filter(Boolean).sort(function (a, b) {
      var aTime = a.latestAt ? a.latestAt.getTime() : 0;
      var bTime = b.latestAt ? b.latestAt.getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a.item.fullName || '').localeCompare(String(b.item.fullName || ''));
    });
  }

  function interviewLogEndOfDay(value) {
    var date = parseDateValue(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function interviewLogStartOfDay(value) {
    var date = parseDateValue(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function profileMatchesInterviewType(profile, typeFilter) {
    if (typeFilter === 'all') return true;
    return profile.rounds.some(function (entry) {
      var label = entry.label || '';
      if (typeFilter === 'custom') return INTERVIEW_TYPE_OPTIONS.indexOf(label) === -1;
      return label === typeFilter;
    });
  }

  function profileMatchesDateRange(profile, fromValue, toValue) {
    if (!fromValue && !toValue) return true;
    var from = fromValue ? interviewLogStartOfDay(fromValue) : null;
    var to = toValue ? interviewLogEndOfDay(toValue) : null;
    return profile.rounds.some(function (entry) {
      var when = parseDateValue(entry.scheduledAt);
      if (!when) return false;
      if (from && when < from) return false;
      if (to && when > to) return false;
      return true;
    });
  }

  function profileMatchesScoreBand(profile, scoreFilter) {
    if (scoreFilter === 'all') return true;
    if (scoreFilter === 'none') return profile.avgScore == null;
    if (profile.avgScore == null) return false;
    if (scoreFilter === 'high') return profile.avgScore >= 8;
    if (scoreFilter === 'mid') return profile.avgScore >= 5 && profile.avgScore < 8;
    if (scoreFilter === 'low') return profile.avgScore < 5;
    return true;
  }

  function profileMatchesActivity(profile, activityFilter) {
    if (activityFilter === 'all') return true;
    if (!profile.latestAt) return false;
    var now = new Date();
    if (activityFilter === 'week') {
      var weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      return profile.latestAt >= weekAgo;
    }
    if (activityFilter === 'month') {
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return profile.latestAt >= monthStart;
    }
    return true;
  }

  function filterInterviewLogProfiles(profiles) {
    var query = (state.interviewLogQuery || '').trim().toLowerCase();
    var resultFilter = state.interviewLogResult || 'all';
    var roleFilter = state.interviewLogRole || 'all';
    var typeFilter = state.interviewLogType || 'all';
    var formatFilter = state.interviewLogFormat || 'all';
    var interviewerFilter = state.interviewLogInterviewer || 'all';
    var scoreFilter = state.interviewLogScore || 'all';
    var statusFilter = state.interviewLogStatus || 'all';
    var notesFilter = state.interviewLogNotes || 'all';
    var roundsFilter = state.interviewLogRounds || 'all';
    var activityFilter = state.interviewLogActivity || 'all';

    return profiles.filter(function (profile) {
      if (resultFilter === 'pass' && !profile.passCount) return false;
      if (resultFilter === 'fail' && !profile.failCount) return false;
      if (resultFilter === 'pending' && !profile.pendingCount) return false;
      if (resultFilter === 'conducted' && !profile.conductedCount) return false;
      if (roleFilter !== 'all' && String(profile.item.role || '') !== roleFilter) return false;
      if (!profileMatchesInterviewType(profile, typeFilter)) return false;
      if (formatFilter !== 'all' && !profile.rounds.some(function (entry) { return interviewFormatOf(entry) === formatFilter; })) return false;
      if (interviewerFilter !== 'all' && !profile.rounds.some(function (entry) { return String(entry.interviewer || '') === interviewerFilter; })) return false;
      if (!profileMatchesDateRange(profile, state.interviewLogFrom, state.interviewLogTo)) return false;
      if (!profileMatchesScoreBand(profile, scoreFilter)) return false;
      if (statusFilter !== 'all' && profile.statusKey !== statusFilter) return false;
      if (notesFilter === 'has' && !profile.hasNotes) return false;
      if (notesFilter === 'missing' && !profile.missingNotes) return false;
      if (roundsFilter === '1' && profile.rounds.length !== 1) return false;
      if (roundsFilter === '2plus' && profile.rounds.length < 2) return false;
      if (roundsFilter === '3plus' && profile.rounds.length < 3) return false;
      if (!profileMatchesActivity(profile, activityFilter)) return false;
      if (!query) return true;
      var haystack = [
        profile.item.fullName,
        profile.item.role,
        profile.item.email,
        profile.item.phone
      ].concat(profile.rounds.map(function (entry) {
        return [entry.label, entry.interviewer, entry.notes, entry.result, interviewFormatOf(entry)].join(' ');
      })).join(' ').toLowerCase();
      return haystack.indexOf(query) > -1;
    });
  }

  function syncInterviewLogFilterOptions(allProfiles) {
    var roleSelect = $('#interviewLogRoleFilter');
    var interviewerSelect = $('#interviewLogInterviewerFilter');
    var roles = [];
    var interviewers = [];
    allProfiles.forEach(function (profile) {
      var role = String(profile.item.role || '').trim();
      if (role && roles.indexOf(role) === -1) roles.push(role);
      profile.rounds.forEach(function (entry) {
        var name = String(entry.interviewer || '').trim();
        if (name && interviewers.indexOf(name) === -1) interviewers.push(name);
      });
    });
    roles.sort(function (a, b) { return a.localeCompare(b); });
    interviewers.sort(function (a, b) { return a.localeCompare(b); });

    function fillSelect(select, selected, blankLabel, values) {
      if (!select) return;
      var html = '<option value="all">' + escapeHtml(blankLabel) + '</option>' + values.map(function (value) {
        return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
      }).join('');
      if (selected && selected !== 'all' && values.indexOf(selected) === -1) {
        html += '<option value="' + escapeHtml(selected) + '" selected>' + escapeHtml(selected) + '</option>';
      }
      select.innerHTML = html;
      select.value = selected || 'all';
    }

    fillSelect(roleSelect, state.interviewLogRole || 'all', 'All roles', roles);
    fillSelect(interviewerSelect, state.interviewLogInterviewer || 'all', 'All interviewers', interviewers);
  }

  function syncInterviewLogFilterControls() {
    var map = {
      interviewLogSearch: 'interviewLogQuery',
      interviewLogResultFilter: 'interviewLogResult',
      interviewLogRoleFilter: 'interviewLogRole',
      interviewLogTypeFilter: 'interviewLogType',
      interviewLogFormatFilter: 'interviewLogFormat',
      interviewLogInterviewerFilter: 'interviewLogInterviewer',
      interviewLogFrom: 'interviewLogFrom',
      interviewLogTo: 'interviewLogTo',
      interviewLogScoreFilter: 'interviewLogScore',
      interviewLogStatusFilter: 'interviewLogStatus',
      interviewLogNotesFilter: 'interviewLogNotes',
      interviewLogRoundsFilter: 'interviewLogRounds',
      interviewLogActivityFilter: 'interviewLogActivity'
    };
    Object.keys(map).forEach(function (id) {
      var node = $('#' + id);
      if (!node) return;
      var value = state[map[id]];
      if (value == null) value = '';
      if (node.value !== value) node.value = value;
    });
  }

  function clearInterviewLogFilters() {
    state.interviewLogQuery = '';
    state.interviewLogResult = 'all';
    state.interviewLogRole = 'all';
    state.interviewLogType = 'all';
    state.interviewLogFormat = 'all';
    state.interviewLogInterviewer = 'all';
    state.interviewLogFrom = '';
    state.interviewLogTo = '';
    state.interviewLogScore = 'all';
    state.interviewLogStatus = 'all';
    state.interviewLogNotes = 'all';
    state.interviewLogRounds = 'all';
    state.interviewLogActivity = 'all';
    renderInterviewLog();
  }

  function readInterviewLogFiltersFromDom() {
    state.interviewLogQuery = (($('#interviewLogSearch') || {}).value || '');
    state.interviewLogResult = (($('#interviewLogResultFilter') || {}).value || 'all');
    state.interviewLogRole = (($('#interviewLogRoleFilter') || {}).value || 'all');
    state.interviewLogType = (($('#interviewLogTypeFilter') || {}).value || 'all');
    state.interviewLogFormat = (($('#interviewLogFormatFilter') || {}).value || 'all');
    state.interviewLogInterviewer = (($('#interviewLogInterviewerFilter') || {}).value || 'all');
    state.interviewLogFrom = (($('#interviewLogFrom') || {}).value || '');
    state.interviewLogTo = (($('#interviewLogTo') || {}).value || '');
    state.interviewLogScore = (($('#interviewLogScoreFilter') || {}).value || 'all');
    state.interviewLogStatus = (($('#interviewLogStatusFilter') || {}).value || 'all');
    state.interviewLogNotes = (($('#interviewLogNotesFilter') || {}).value || 'all');
    state.interviewLogRounds = (($('#interviewLogRoundsFilter') || {}).value || 'all');
    state.interviewLogActivity = (($('#interviewLogActivityFilter') || {}).value || 'all');
  }

  function renderInterviewLogCounts() {
    var count = collectInterviewLogProfiles().length;
    $$('[data-interview-log-count]').forEach(function (node) { node.textContent = count; });
  }

  function interviewScoreBadge(score) {
    if (score == null || score === '') return '<span class="ilog-score is-empty">—</span>';
    var num = Number(score);
    var tone = num >= 8 ? 'high' : (num >= 5 ? 'mid' : 'low');
    return '<span class="ilog-score is-' + tone + '">' + escapeHtml(String(num)) + '<small>/10</small></span>';
  }

  function interviewRoundCardHtml(entry, index) {
    var result = entry.result || 'pending';
    var when = parseDateValue(entry.scheduledAt);
    var whenLabel = when ? formatDate(when.toISOString(), true) : 'Not scheduled';
    return '<article class="ilog-round is-' + escapeHtml(result) + '">' +
      '<header class="ilog-round__head">' +
      '<div><span class="ilog-round__index">Round ' + (index + 1) + '</span>' +
      '<h4>' + escapeHtml(entry.label || 'Interview') + '</h4></div>' +
      '<span class="ilog-result is-' + escapeHtml(result) + '">' + escapeHtml(interviewResultLabel(result)) + '</span>' +
      '</header>' +
      '<div class="ilog-round__grid">' +
      '<div><span>Format</span><strong>' + escapeHtml(interviewFormatLabel(interviewFormatOf(entry))) + '</strong></div>' +
      '<div><span>Interviewer</span><strong>' + escapeHtml(entry.interviewer || '—') + '</strong></div>' +
      '<div><span>When</span><strong>' + escapeHtml(whenLabel) + '</strong></div>' +
      '<div><span>Score</span>' + interviewScoreBadge(entry.score) + '</div>' +
      '</div>' +
      '<div class="ilog-round__notes">' +
      '<span>Notes</span>' +
      '<p>' + (entry.notes ? escapeHtml(entry.notes) : 'No notes recorded for this round.') + '</p>' +
      '</div></article>';
  }

  function renderInterviewLogDetail(profile) {
    var detail = $('#interviewLogDetail');
    var empty = $('#interviewLogDetailEmpty');
    if (!detail || !empty) return;
    if (!profile) {
      empty.classList.remove('is-hidden');
      detail.classList.add('is-hidden');
      detail.innerHTML = '';
      return;
    }
    empty.classList.add('is-hidden');
    detail.classList.remove('is-hidden');
    var item = profile.item;
    var pipe = pipelineOf(item);
    detail.innerHTML =
      '<header class="ilog-profile__head">' +
      '<div class="ilog-profile__identity">' +
      '<span class="ilog-profile__avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span>' +
      '<div><span class="ilog-profile__role">' + escapeHtml(item.role || 'Role') + '</span>' +
      '<h2>' + escapeHtml(item.fullName || 'Candidate') + '</h2>' +
      '<p><span class="ilog-chip">' + escapeHtml(profile.outcome) + '</span> ' +
      escapeHtml(profile.rounds.length + (profile.rounds.length === 1 ? ' interview round' : ' interview rounds')) +
      '</p></div></div>' +
      '<div class="ilog-profile__actions">' +
      (item.linkedin ? '<a class="secondary-btn" href="' + escapeHtml(item.linkedin) + '" target="_blank" rel="noopener"><i class="ti ti-brand-linkedin"></i> LinkedIn</a>' : '') +
      '<a class="secondary-btn" href="/api/admin/applications/' + encodeURIComponent(item.id) + '/resume"><i class="ti ti-download"></i> CV</a>' +
      '<button class="primary-btn" type="button" data-open-pipeline="' + escapeHtml(item.id) + '"><i class="ti ti-route"></i> Open pipeline</button>' +
      '</div></header>' +
      '<div class="ilog-stats">' +
      '<article><small>Rounds</small><strong>' + profile.rounds.length + '</strong></article>' +
      '<article><small>Avg score</small><strong>' + (profile.avgScore == null ? '—' : profile.avgScore + '/10') + '</strong></article>' +
      '<article><small>Passed</small><strong>' + profile.passCount + '</strong></article>' +
      '<article><small>Failed</small><strong>' + profile.failCount + '</strong></article>' +
      '</div>' +
      '<ul class="ilog-contact">' +
      '<li><span>Email</span><a href="mailto:' + encodeURIComponent(item.email || '') + '">' + escapeHtml(item.email || '—') + '</a></li>' +
      '<li><span>Phone</span><a href="tel:' + encodeURIComponent(item.phone || '') + '">' + escapeHtml(item.phone || '—') + '</a></li>' +
      '<li><span>Pathway</span><strong>' + escapeHtml((pipe.pathway === 'with_tasks' ? 'With tasks' : (pipe.pathway === 'no_tasks' ? 'No tasks' : '—'))) + '</strong></li>' +
      '<li><span>Latest interview</span><strong>' + escapeHtml(profile.latestAt ? formatDate(profile.latestAt.toISOString(), true) : '—') + '</strong></li>' +
      '</ul>' +
      '<section class="ilog-rounds">' +
      '<div class="ilog-rounds__head"><h3>Interview rounds</h3><p>Scores, interviewers, and notes for every conducted or scheduled round</p></div>' +
      profile.rounds.map(interviewRoundCardHtml).join('') +
      '</section>';
  }

  function renderInterviewLog() {
    if (!isHr()) return;
    renderInterviewLogCounts();
    var allProfiles = collectInterviewLogProfiles();
    syncInterviewLogFilterOptions(allProfiles);
    syncInterviewLogFilterControls();
    var profiles = filterInterviewLogProfiles(allProfiles);
    var meta = $('#interviewLogListMeta');
    if (meta) {
      meta.textContent = profiles.length + ' of ' + allProfiles.length + ' candidate' + (allProfiles.length === 1 ? '' : 's');
    }

    var list = $('#interviewLogList');
    var empty = $('#interviewLogListEmpty');
    if (!list || !empty) return;
    empty.classList.toggle('is-hidden', profiles.length > 0);
    list.classList.toggle('is-hidden', !profiles.length);
    list.innerHTML = profiles.map(function (profile) {
      var selected = profile.item.id === state.interviewLogSelectedId ? ' is-selected' : '';
      return '<button class="ilog-row' + selected + '" type="button" data-interview-log-id="' + escapeHtml(profile.item.id) + '">' +
        '<span class="ilog-row__avatar">' + escapeHtml(applicationInitials(profile.item.fullName)) + '</span>' +
        '<span class="ilog-row__copy"><strong>' + escapeHtml(profile.item.fullName || 'Candidate') + '</strong>' +
        '<small>' + escapeHtml(profile.item.role || 'Role') + ' · ' + profile.rounds.length + ' round' + (profile.rounds.length === 1 ? '' : 's') + '</small></span>' +
        '<span class="ilog-row__aside">' + interviewScoreBadge(profile.avgScore) +
        '<span class="ilog-chip">' + escapeHtml(profile.outcome) + '</span></span>' +
        '</button>';
    }).join('');

    if (!state.interviewLogSelectedId && profiles.length) state.interviewLogSelectedId = profiles[0].item.id;
    if (state.interviewLogSelectedId && !profiles.some(function (profile) { return profile.item.id === state.interviewLogSelectedId; })) {
      state.interviewLogSelectedId = profiles.length ? profiles[0].item.id : '';
    }
    var selectedProfile = profiles.find(function (profile) { return profile.item.id === state.interviewLogSelectedId; }) || null;
    renderInterviewLogDetail(selectedProfile);
  }

  function renderHrAnalytics() {
    var fromInput = $('#analyticsFrom');
    var toInput = $('#analyticsTo');
    var outcomeInput = $('#analyticsOutcomeFilter');
    if (fromInput && fromInput.value !== state.analyticsFrom) fromInput.value = state.analyticsFrom || '';
    if (toInput && toInput.value !== state.analyticsTo) toInput.value = state.analyticsTo || '';
    if (outcomeInput) outcomeInput.value = state.analyticsOutcome || 'all';

    var rows = analyticsCandidateRows(state.applications || []);
    var accepted = rows.filter(function (row) { return row.outcome === 'accepted'; });
    var rejected = rows.filter(function (row) { return row.outcome === 'rejected'; });
    var hireDays = accepted.map(function (row) { return row.timeToHireDays; }).filter(function (value) { return value != null; });
    var avgHire = hireDays.length
      ? Math.round(hireDays.reduce(function (sum, value) { return sum + value; }, 0) / hireDays.length) + 'd'
      : '—';
    var interviewTotal = rows.reduce(function (sum, row) { return sum + row.interviews; }, 0);

    $('#analyticsHiredCount').textContent = accepted.length;
    $('#analyticsRejectedCount').textContent = rejected.length;
    $('#analyticsAvgHire').textContent = avgHire;
    $('#analyticsInterviewCount').textContent = interviewTotal;

    state.analyticsAcceptedRows = accepted;
    state.analyticsRejectedRows = rejected;
    state.analyticsAcceptedShown = renderAnalyticsPeopleTable(accepted, '#analyticsAcceptedEmpty', '#analyticsAcceptedList', 'accepted', ANALYTICS_PAGE_SIZE);
    state.analyticsRejectedShown = renderAnalyticsPeopleTable(rejected, '#analyticsRejectedEmpty', '#analyticsRejectedList', 'rejected', ANALYTICS_PAGE_SIZE);

    var vacancies = closedVacancyAnalytics(rows);
    var vacancyList = $('#analyticsVacancyList');
    var vacancyEmpty = $('#analyticsVacancyEmpty');
    var hasVacancies = vacancies.length > 0;
    if (vacancyEmpty) vacancyEmpty.classList.toggle('is-hidden', hasVacancies);
    if (vacancyList) {
      vacancyList.classList.toggle('is-hidden', !hasVacancies);
      vacancyList.innerHTML = hasVacancies
        ? '<table class="hr-table analytics-table"><thead><tr><th>Vacancy</th><th>Status</th><th>Hired</th><th>Rejected</th><th>Interviews</th><th>Avg. time to hire</th></tr></thead><tbody>' +
          vacancies.map(function (entry) {
            return '<tr>' +
              '<td><strong>' + escapeHtml(entry.title) + '</strong></td>' +
              '<td>' + (entry.unpublished ? 'Unpublished' : (entry.hired ? 'Hired' : 'Closed')) + '</td>' +
              '<td>' + entry.hired + '</td>' +
              '<td>' + entry.rejected + '</td>' +
              '<td>' + entry.interviews + '</td>' +
              '<td>' + (entry.avgTimeToHire == null ? '—' : entry.avgTimeToHire + 'd') + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>'
        : '';
    }
  }

  function matchesHrFilter(item, filter) {
    if (filter === 'all') return true;
    if (filter === 'open') return !isPipelineClosed(item);
    if (filter === 'closed') return isPipelineClosed(item);
    return pipelineStageKey(item) === filter;
  }

  function renderHrPortal() {
    var list = (state.applications || []).filter(isInHiringProcess);
    if (state.hrFilter === 'closed') state.hrFilter = 'open';
    var openList = list.slice();
    var phoneCount = list.filter(function (item) { return pipelineStageKey(item) === 'phone_screen'; }).length;
    var taskCount = list.filter(function (item) { return pipelineStageKey(item) === 'task'; }).length;
    var interviewCount = list.filter(function (item) { return pipelineStageKey(item) === 'interview'; }).length;
    var offerCount = list.filter(function (item) { return pipelineStageKey(item) === 'offer'; }).length;
    $$('[data-hr-pipeline-count]').forEach(function (node) {
      node.textContent = openList.length;
      node.classList.toggle('is-zero', openList.length === 0);
    });
    $('#hrPipelineTotal').textContent = list.length;
    $('#hrOpenCount').textContent = openList.length;
    $('#hrPhoneCount').textContent = phoneCount;
    $('#hrTaskCount').textContent = taskCount;
    $('#hrInterviewCount').textContent = interviewCount;
    $('#hrOfferCount').textContent = offerCount;
    $$('#hrMetrics [data-hr-filter]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.hrFilter === state.hrFilter);
    });

    var query = state.hrQuery.trim().toLowerCase();
    var filtered = list.filter(function (item) {
      if (!matchesHrFilter(item, state.hrFilter)) return false;
      return !query || [item.fullName, item.role, item.email, item.phone].join(' ').toLowerCase().indexOf(query) > -1;
    });

    var selected = filtered.find(function (item) { return item.id === state.hrSelectedId; }) || null;
    if (state.hrSelectedId && !selected) state.hrSelectedId = '';

    var listMeta = $('#hrListMeta');
    if (listMeta) {
      listMeta.textContent = filtered.length + ' candidate' + (filtered.length === 1 ? '' : 's') +
        (state.hrFilter === 'open' || state.hrFilter === 'all' ? '' : ' · ' + pipelineStageLabel(state.hrFilter));
    }

    $('#hrPickPrompt').classList.toggle('is-hidden', filtered.length > 0);
    $('#hrPipelineList').classList.toggle('is-hidden', filtered.length === 0);
    $('#hrPipelineList').innerHTML = filtered.map(function (item) {
      var pipe = pipelineOf(item);
      var pathway = pipe.pathway === 'with_tasks' ? 'Tasks' : (pipe.pathway === 'no_tasks' ? 'Direct' : 'Pathway TBD');
      var active = item.id === state.hrSelectedId;
      return '<button class="hr-candidate-row' + (active ? ' is-selected' : '') + '" type="button" data-hr-row-id="' + escapeHtml(item.id) + '" data-open-pipeline="' + escapeHtml(item.id) + '">' +
        '<span class="application-avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span>' +
        '<span class="hr-candidate-row__copy">' +
        '<strong>' + escapeHtml(item.fullName || 'Candidate') + '</strong>' +
        '<small>' + escapeHtml(item.role || 'Role') + ' · ' + escapeHtml(phoneScreenLabel(pipe.phoneScreen)) + '</small>' +
        '</span>' +
        '<span class="hr-candidate-row__aside">' +
        '<span class="pipeline-chip">' + escapeHtml(pipelineStageLabel(pipe.stage)) + '</span>' +
        '<small>' + escapeHtml(pathway) + '</small>' +
        '</span></button>';
    }).join('');

    renderHrPipelineDetail(selected);
  }

  async function saveHrPipeline(event) {
    event.preventDefault();
    if (!state.hrSelectedId) return;
    var form = $('#hrPipelineForm');
    if (!form) return;
    var button = $('button[type="submit"]', form);
    var payload = collectPipelineFromForm(form);
    if (payload.phoneScreen === 'accepted' && !payload.pathway) {
      toast('Choose a pathway after accepting the phone screen.', true);
      return;
    }
    if (payload.pathway === 'with_tasks' && !payload.task.title) {
      toast('Add a task title for the tasks pathway.', true);
      return;
    }
    var interviewScoreError = validateInterviewScores(payload.interviews, form);
    if (interviewScoreError) {
      toast(interviewScoreError, true);
      return;
    }
    var interviewScheduleError = validateInterviewSchedule(payload.interviews, form);
    if (interviewScheduleError) {
      toast(interviewScheduleError, true);
      return;
    }
    if (payload.offer.status === 'declined' && !payload.offer.declinedReason) {
      toast('Provide a decline reason.', true);
      return;
    }
    try {
      setBusy(button, true);
      var result = await api('/api/admin/applications/' + encodeURIComponent(state.hrSelectedId) + '/pipeline', {
        method: 'PUT',
        body: JSON.stringify({ pipeline: payload })
      });
      state.applications = result.applications || state.applications;
      renderHrPortal();
      renderApplications();
      if (payload.offer && payload.offer.status === 'joined') {
        if (canUseOnboarding()) {
          await loadOnboarding();
          if (result.onboarding && result.onboarding.request) {
            state.onboardingSelectedId = result.onboarding.request.id;
            renderOnboarding();
          }
          toast(result.onboarding && result.onboarding.created
            ? 'Joined — candidate added to Employee Onboarding.'
            : 'Joined — candidate is in Employee Onboarding.');
        } else {
          toast('Hiring pipeline saved.');
        }
      } else {
        var mailInfo = result.mail || {};
        var notices = mailInfo.scheduleNotices || [];
        var sentNotice = notices.find(function (entry) { return entry.sent; });
        if (sentNotice) {
          toast('Interview email sent to ' + (sentNotice.interviewer || 'interviewer') + '.');
        } else if (mailInfo.failed) {
          toast('Pipeline saved, but the interview email failed to send.', true);
        } else if (mailInfo.skipped && notices.length) {
          toast('Pipeline saved. Interview email skipped (mail not configured).');
        } else {
          toast('Hiring pipeline saved.');
        }
      }
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  function renderContactRequests() {
    if (!isAdmin()) return;
    var list = state.contactRequests || [];
    var newCount = list.filter(function (item) { return item.status === 'new'; }).length;
    var progressCount = list.filter(function (item) { return item.status === 'reviewing' || item.status === 'contacted'; }).length;
    $$('[data-contact-count]').forEach(function (node) { node.textContent = newCount; node.classList.toggle('is-zero', newCount === 0); });
    $('#contactTotal').textContent = list.length;
    $('#contactNew').textContent = newCount;
    $('#contactProgress').textContent = progressCount;

    var query = state.contactQuery.trim().toLowerCase();
    var filtered = list.filter(function (item) {
      var statusMatch = state.contactStatus === 'all' || item.status === state.contactStatus;
      var situationMatch = state.contactSituation === 'all' || item.situation === state.contactSituation;
      var searchMatch = !query || [item.name, item.organization, item.email, item.role, item.situationLabel, item.message].join(' ').toLowerCase().indexOf(query) > -1;
      return statusMatch && situationMatch && searchMatch;
    });
    $('#contactRequestsEmpty').classList.toggle('is-hidden', filtered.length > 0);
    $('#contactRequestsList').classList.toggle('is-hidden', filtered.length === 0);
    $('#contactRequestsList').innerHTML = filtered.map(function (item) {
      var status = item.status || 'new';
      var statusOptions = [['new', 'New'], ['reviewing', 'Reviewing'], ['contacted', 'Contacted'], ['closed', 'Closed']];
      var select = statusOptions.map(function (option) { return '<option value="' + option[0] + '"' + (option[0] === status ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('');
      return '<article class="panel application-card contact-request-card" data-contact-id="' + escapeHtml(item.id) + '">' +
        '<header><span class="application-avatar">' + escapeHtml(applicationInitials(item.name)) + '</span><div><span class="application-role">' + escapeHtml(item.situationLabel || item.situation) + '</span><h2>' + escapeHtml(item.name) + '</h2><p>Reference ' + escapeHtml(item.reference || '') + ' · Submitted ' + escapeHtml(formatDate(item.submittedAt, true)) + '</p></div><label class="application-status application-status--' + escapeHtml(status === 'closed' ? 'rejected' : status) + '"><span>Status</span><select data-contact-status>' + select + '</select></label></header>' +
        '<div class="application-details"><div><small>Email</small><a href="mailto:' + encodeURIComponent(item.email) + '">' + escapeHtml(item.email) + '</a></div><div><small>Organization</small><strong>' + escapeHtml(item.organization) + '</strong></div><div><small>Role / Title</small><strong>' + escapeHtml(item.role || '—') + '</strong></div></div>' +
        '<div class="contact-request-message"><small>Message</small><p>' + escapeHtml(item.message) + '</p></div>' +
        '<footer><a class="primary-btn" href="mailto:' + encodeURIComponent(item.email) + '?subject=' + encodeURIComponent('Re: Digital Hub enquiry (' + (item.reference || '') + ')') + '"><i class="ti ti-mail"></i> Reply by email</a></footer></article>';
    }).join('');
  }

  async function updateContactStatus(select) {
    var card = select.closest('[data-contact-id]');
    if (!card) return;
    select.disabled = true;
    try {
      var result = await api('/api/admin/contact-requests/' + encodeURIComponent(card.dataset.contactId), { method: 'PUT', body: JSON.stringify({ status: select.value }) });
      state.contactRequests = result.requests || state.contactRequests;
      renderContactRequests();
      toast('Request status updated.');
    } catch (error) {
      toast(error.message, true);
      renderContactRequests();
    }
  }

  function clearUserPhotoPreview() {
    var drop = $('#userForm .image-drop');
    if (!drop) return;
    var preview = $('.image-preview', drop);
    var remove = $('[data-remove-image]', drop);
    if (preview) preview.remove();
    if (remove) remove.remove();
    var pathInput = $('#userForm [name="photo"]');
    if (pathInput) pathInput.value = '';
  }

  function setUserPhotoPreview(path) {
    var drop = $('#userForm .image-drop');
    var pathInput = $('#userForm [name="photo"]');
    if (!drop || !pathInput) return;
    pathInput.value = path || '';
    var old = $('.image-preview', drop); if (old) old.remove();
    var removeBtn = $('[data-remove-image]', drop); if (removeBtn) removeBtn.remove();
    if (!path) return;
    var image = document.createElement('img');
    image.className = 'image-preview';
    image.src = publicUrl(path);
    image.alt = 'Preview';
    drop.appendChild(image);
    var remove = document.createElement('button');
    remove.className = 'image-remove';
    remove.type = 'button';
    remove.dataset.removeImage = '';
    remove.innerHTML = '<i class="ti ti-x"></i>';
    drop.appendChild(remove);
  }

  function absoluteInviteUrl(path) {
    try {
      return new URL(path, window.location.origin).href;
    } catch (_) {
      return path;
    }
  }

  function openInviteModal(inviteUrl) {
    var absolute = absoluteInviteUrl(inviteUrl);
    $('#inviteUrlInput').value = absolute;
    $('#inviteModalBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeInviteModal() {
    $('#inviteModalBackdrop').classList.remove('is-open');
    $('#inviteUrlInput').value = '';
    if (!$('#userModalBackdrop').classList.contains('is-open')) document.body.style.overflow = '';
  }

  function onboardingStatusLabel(status) {
    return ({ draft: 'Draft', sent: 'Sent', returned: 'Returned', completed: 'Completed' })[status] || status;
  }

  function onboardingAssetLabels() {
    return {
      onboardingPost: 'DH onboarding post',
      joiningPost: 'Employee joining post',
      businessCard: 'Business card',
      employeeId: 'Employee ID'
    };
  }

  function findOnboardingForApplication(applicationId) {
    return (state.onboardingRequests || []).find(function (item) {
      return item.applicationId === applicationId && item.status !== 'completed';
    });
  }

  async function startOnboardingFromApplication(applicationId) {
    if (!isHr()) return;
    try {
      var result = await api('/api/admin/onboarding', {
        method: 'POST',
        body: JSON.stringify({ applicationId: applicationId }),
      });
      state.onboardingRequests = result.requests || state.onboardingRequests;
      if (result.request) state.onboardingSelectedId = result.request.id;
      switchView('onboarding');
      renderOnboarding();
      toast(result.existing ? 'Opened the existing onboarding package.' : 'Onboarding draft created. Complete the package and send to Marketing.');
    } catch (error) {
      toast(error.message, true);
    }
  }

  function renderOnboarding() {
    if (!canUseOnboarding()) return;
    var list = state.onboardingRequests || [];
    var openCount = list.filter(function (item) { return item.status === 'sent' || item.status === 'draft' || item.status === 'returned'; }).length;
    $$('[data-onboarding-count]').forEach(function (node) { node.textContent = openCount; });
    var filter = state.onboardingStatus || 'all';
    var statusSelect = $('#onboardingStatusFilter');
    if (statusSelect && statusSelect.value !== filter) statusSelect.value = filter;
    if (isMarketing()) {
      var draftOpt = statusSelect && statusSelect.querySelector('option[value="draft"]');
      if (draftOpt) draftOpt.hidden = true;
      if (filter === 'draft') {
        state.onboardingStatus = 'all';
        filter = 'all';
        if (statusSelect) statusSelect.value = 'all';
      }
    }
    var filtered = list.filter(function (item) {
      return filter === 'all' || item.status === filter;
    });
    var listEl = $('#onboardingList');
    var empty = $('#onboardingListEmpty');
    if (!listEl || !empty) return;
    empty.classList.toggle('is-hidden', filtered.length > 0);
    listEl.classList.toggle('is-hidden', !filtered.length);
    var emptyCopy = $('#onboardingListEmptyCopy');
    if (emptyCopy) {
      emptyCopy.textContent = isMarketing()
        ? 'When HR sends a package, it will appear here.'
        : 'Start onboarding from a Joined candidate in Active Hiring or Analytics.';
    }
    listEl.innerHTML = filtered.map(function (item) {
      var selected = item.id === state.onboardingSelectedId ? ' is-selected' : '';
      return '<button class="onboarding-row' + selected + '" type="button" data-onboarding-id="' + escapeHtml(item.id) + '">' +
        '<span class="onboarding-row__avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span>' +
        '<span class="onboarding-row__copy"><strong>' + escapeHtml(item.fullName || 'Employee') + '</strong>' +
        '<small>' + escapeHtml(item.jobTitle || 'Role') + '</small></span>' +
        '<span class="onboarding-status is-' + escapeHtml(item.status) + '">' + escapeHtml(onboardingStatusLabel(item.status)) + '</span>' +
        '</button>';
    }).join('');
    if (!state.onboardingSelectedId && filtered.length) state.onboardingSelectedId = filtered[0].id;
    if (state.onboardingSelectedId && !list.some(function (item) { return item.id === state.onboardingSelectedId; })) {
      state.onboardingSelectedId = filtered.length ? filtered[0].id : '';
    }
    renderOnboardingDetail();
  }

  function onboardingAssetSlotHtml(key, path, editable) {
    var labels = onboardingAssetLabels();
    var hasFile = Boolean(path);
    var isPdf = /\.pdf$/i.test(path || '');
    var preview = hasFile
      ? (isPdf
        ? '<div class="onboarding-asset__preview is-file"><i class="ti ti-file-type-pdf"></i><span>PDF uploaded</span></div>'
        : '<div class="onboarding-asset__preview"><img src="' + escapeHtml(publicUrl(path)) + '" alt=""></div>')
      : '<div class="onboarding-asset__preview is-empty"><i class="ti ti-cloud-upload"></i><span>No file yet</span></div>';
    var actions = hasFile
      ? '<a class="secondary-btn" href="' + escapeHtml(publicUrl(path)) + '" target="_blank" rel="noopener" download><i class="ti ti-download"></i> Download</a>'
      : '';
    var upload = editable
      ? '<label class="secondary-btn file-btn"><i class="ti ti-upload"></i> Upload<input type="file" data-onboarding-upload="' + escapeHtml(key) + '" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"></label>'
      : '';
    return '<article class="onboarding-asset" data-asset-key="' + escapeHtml(key) + '">' +
      '<header><strong>' + escapeHtml(labels[key] || key) + '</strong>' +
      '<span class="onboarding-asset__badge' + (hasFile ? ' is-ready' : '') + '">' + (hasFile ? 'Ready' : 'Needed') + '</span></header>' +
      preview +
      '<div class="onboarding-asset__actions">' + upload + actions + '</div>' +
      '<input type="hidden" name="assets.' + escapeHtml(key) + '" value="' + escapeHtml(path || '') + '">' +
      '</article>';
  }

  function renderOnboardingDetail() {
    var detail = $('#onboardingDetail');
    var empty = $('#onboardingDetailEmpty');
    if (!detail || !empty) return;
    var item = (state.onboardingRequests || []).find(function (entry) { return entry.id === state.onboardingSelectedId; });
    if (!item) {
      empty.classList.remove('is-hidden');
      detail.classList.add('is-hidden');
      detail.innerHTML = '';
      return;
    }
    empty.classList.add('is-hidden');
    detail.classList.remove('is-hidden');
    var assets = item.assets || {};
    var hrEditable = isHr() && item.status === 'draft';
    var marketingEditable = isMarketing() && (item.status === 'sent' || item.status === 'returned');
    var canSend = isHr() && (item.status === 'draft' || item.status === 'returned');
    var canComplete = isHr() && item.status === 'returned';
    var packageReadonly = !hrEditable;
    var ro = packageReadonly ? ' readonly' : '';

    detail.innerHTML =
      '<header class="onboarding-detail__head">' +
      '<div><span class="onboarding-status is-' + escapeHtml(item.status) + '">' + escapeHtml(onboardingStatusLabel(item.status)) + '</span>' +
      '<h2>' + escapeHtml(item.fullName || 'Employee') + '</h2>' +
      '<p>' + escapeHtml(item.jobTitle || '') + (item.reference ? ' · Ref ' + escapeHtml(item.reference) : '') + '</p></div>' +
      '<div class="onboarding-detail__meta"><small>Updated</small><strong>' + escapeHtml(relativeTime(item.updatedAt || item.createdAt)) + '</strong></div>' +
      '</header>' +
      '<form class="onboarding-form" id="onboardingForm">' +
      '<section class="onboarding-card">' +
      '<div class="onboarding-card__head"><div><h3>Employee package</h3><p>Details Marketing needs for joining assets</p></div></div>' +
      '<div class="onboarding-card__body"><div class="onboarding-fields">' +
      '<label class="onboarding-field"><span>Full name</span><input name="fullName" type="text" value="' + escapeHtml(item.fullName || '') + '"' + ro + ' required autocomplete="name"></label>' +
      '<label class="onboarding-field"><span>Job title / role</span><input name="jobTitle" type="text" value="' + escapeHtml(item.jobTitle || '') + '"' + ro + ' required></label>' +
      '<label class="onboarding-field"><span>Email</span><input name="email" type="email" value="' + escapeHtml(item.email || '') + '"' + ro + ' required autocomplete="email" placeholder="name@company.com"></label>' +
      '<label class="onboarding-field"><span>Mobile number</span><input name="mobile" type="tel" value="' + escapeHtml(item.mobile || '') + '"' + ro + ' required autocomplete="tel" placeholder="+20..."></label>' +
      '<label class="onboarding-field"><span>LinkedIn</span><input name="linkedin" type="url" value="' + escapeHtml(item.linkedin || '') + '"' + ro + ' placeholder="https://www.linkedin.com/in/..." required></label>' +
      '<label class="onboarding-field"><span>ID number</span><input name="idNumber" type="text" value="' + escapeHtml(item.idNumber || '') + '"' + ro + ' required autocomplete="off"></label>' +
      '<label class="onboarding-field is-full"><span>Notes for Marketing</span><textarea name="notesHr" rows="3"' + ro + ' placeholder="Optional context for the posts or card">' + escapeHtml(item.notesHr || '') + '</textarea></label>' +
      '</div></div></section>' +
      '<section class="onboarding-card">' +
      '<div class="onboarding-card__head"><div><h3>Marketing deliverables</h3><p>Posts, business card, and employee ID</p></div></div>' +
      '<div class="onboarding-card__body">' +
      '<div class="onboarding-assets">' +
      onboardingAssetSlotHtml('onboardingPost', assets.onboardingPost, marketingEditable) +
      onboardingAssetSlotHtml('joiningPost', assets.joiningPost, marketingEditable) +
      onboardingAssetSlotHtml('businessCard', assets.businessCard, marketingEditable) +
      onboardingAssetSlotHtml('employeeId', assets.employeeId, marketingEditable) +
      '</div>' +
      (isMarketing() || item.notesMarketing
        ? '<label class="onboarding-field is-full" style="margin-top:14px"><span>Notes from Marketing</span><textarea name="notesMarketing" rows="3"' + (marketingEditable ? '' : ' readonly') + '>' + escapeHtml(item.notesMarketing || '') + '</textarea></label>'
        : '') +
      '</div></section>' +
      '<div class="onboarding-actions">' +
      (hrEditable ? '<button class="secondary-btn" type="submit" data-onboarding-action="save"><i class="ti ti-device-floppy"></i> Save draft</button>' : '') +
      (canSend ? '<button class="primary-btn" type="submit" data-onboarding-action="send"><i class="ti ti-send"></i> Send to Marketing</button>' : '') +
      (marketingEditable ? '<button class="secondary-btn" type="submit" data-onboarding-action="save"><i class="ti ti-device-floppy"></i> Save uploads</button><button class="primary-btn" type="submit" data-onboarding-action="return"><i class="ti ti-arrow-back-up"></i> Return to HR</button>' : '') +
      (canComplete ? '<button class="primary-btn" type="submit" data-onboarding-action="complete"><i class="ti ti-circle-check"></i> Mark completed</button>' : '') +
      '</div></form>';
  }

  function collectOnboardingFormPayload(action) {
    var form = $('#onboardingForm');
    if (!form) return null;
    var payload = { action: action || '' };
    if (isHr()) {
      payload.fullName = (form.elements.fullName && form.elements.fullName.value || '').trim();
      payload.jobTitle = (form.elements.jobTitle && form.elements.jobTitle.value || '').trim();
      payload.email = (form.elements.email && form.elements.email.value || '').trim();
      payload.mobile = (form.elements.mobile && form.elements.mobile.value || '').trim();
      payload.linkedin = (form.elements.linkedin && form.elements.linkedin.value || '').trim();
      payload.idNumber = (form.elements.idNumber && form.elements.idNumber.value || '').trim();
      payload.notesHr = (form.elements.notesHr && form.elements.notesHr.value || '').trim();
    }
    if (isMarketing()) {
      payload.assets = {
        onboardingPost: (form.elements['assets.onboardingPost'] && form.elements['assets.onboardingPost'].value) || '',
        joiningPost: (form.elements['assets.joiningPost'] && form.elements['assets.joiningPost'].value) || '',
        businessCard: (form.elements['assets.businessCard'] && form.elements['assets.businessCard'].value) || '',
        employeeId: (form.elements['assets.employeeId'] && form.elements['assets.employeeId'].value) || '',
      };
      payload.notesMarketing = (form.elements.notesMarketing && form.elements.notesMarketing.value || '').trim();
    }
    return payload;
  }

  async function saveOnboarding(event) {
    event.preventDefault();
    var submitter = event.submitter || document.activeElement;
    var action = (submitter && submitter.dataset && submitter.dataset.onboardingAction) || 'save';
    var item = (state.onboardingRequests || []).find(function (entry) { return entry.id === state.onboardingSelectedId; });
    if (!item) return;
    var payload = collectOnboardingFormPayload(action === 'save' ? '' : action);
    if (!payload) return;
    var button = submitter && submitter.tagName === 'BUTTON' ? submitter : null;
    try {
      setBusy(button, true);
      var result = await api('/api/admin/onboarding/' + encodeURIComponent(item.id), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      state.onboardingRequests = result.requests || state.onboardingRequests;
      if (result.request) state.onboardingSelectedId = result.request.id;
      renderOnboarding();
      toast(action === 'send'
        ? 'Package sent to Marketing.'
        : (action === 'return'
          ? 'Deliverables returned to HR.'
          : (action === 'complete' ? 'Onboarding marked completed.' : 'Onboarding request saved.')));
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(button, false);
    }
  }

  async function uploadOnboardingAsset(file, key, input) {
    if (!file || !key) return;
    if (file.size > 5 * 1024 * 1024) return toast('File is over 5 MB.', true);
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    var isImage = /^image\/(png|jpeg|webp|gif)$/i.test(file.type);
    if (!isPdf && !isImage) return toast('Use a PNG, JPG, WEBP, GIF, or PDF file.', true);
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        toast(isPdf ? 'Uploading PDF...' : 'Uploading image...');
        var result = await api('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ name: file.name, dataUrl: reader.result }),
        });
        if (state.data && state.data.meta) state.data.meta.revision = result.revision;
        var field = input && input.closest ? input.closest('.onboarding-asset') : null;
        var pathInput = field && $('[name="assets.' + key + '"]', field);
        if (pathInput) pathInput.value = result.path;
        var item = (state.onboardingRequests || []).find(function (entry) { return entry.id === state.onboardingSelectedId; });
        if (item) {
          if (!item.assets) item.assets = {};
          item.assets[key] = result.path;
        }
        renderOnboardingDetail();
        toast('File uploaded. Save or return to HR when ready.');
      } catch (error) {
        toast(error.message, true);
      }
    };
    reader.readAsDataURL(file);
  }

  function renderUsers() {
    if (!isAdmin()) return;
    var managedUsers = state.users.filter(function (user) { return user.role === 'hr' || user.role === 'marketing'; });
    var hrUsers = managedUsers.filter(function (user) { return user.role === 'hr'; });
    var marketingUsers = managedUsers.filter(function (user) { return user.role === 'marketing'; });
    $('#usersTotal').textContent = state.users.length;
    $('#usersActive').textContent = hrUsers.filter(function (user) { return user.active; }).length;
    var marketingCount = $('#usersMarketing');
    if (marketingCount) marketingCount.textContent = marketingUsers.filter(function (user) { return user.active; }).length;
    $('#usersDisabled').textContent = managedUsers.filter(function (user) { return !user.active; }).length;
    $$('[data-user-count]').forEach(function (node) { node.textContent = managedUsers.length; });
    $('#usersList').innerHTML = state.users.slice().sort(function (a, b) {
      var order = { admin: 0, hr: 1, marketing: 2 };
      var left = order[a.role] != null ? order[a.role] : 9;
      var right = order[b.role] != null ? order[b.role] : 9;
      if (left !== right) return left - right;
      return String(a.name || '').localeCompare(String(b.name || ''));
    }).map(function (user) {
      var managed = user.role === 'hr' || user.role === 'marketing';
      var marketing = user.role === 'marketing';
      var pending = managed && user.mustSetPassword;
      var avatar = user.photo
        ? '<span class="account-avatar has-photo' + (managed ? (marketing ? ' is-marketing' : ' is-hr') : '') + '"><img src="' + escapeHtml(publicUrl(user.photo)) + '" alt=""></span>'
        : '<span class="account-avatar' + (managed ? (marketing ? ' is-marketing' : ' is-hr') : '') + '">' + escapeHtml(accountInitials(user)) + '</span>';
      var meta = managed
        ? '<small>@' + escapeHtml(user.username) + (user.email ? ' · ' + escapeHtml(user.email) : '') + '</small>'
        : '<small>@' + escapeHtml(user.username) + '</small>';
      var actions = managed
        ? '<div class="user-actions"><button class="card-action" type="button" data-user-action="edit" title="Edit account"><i class="ti ti-pencil"></i></button><button class="card-action is-danger" type="button" data-user-action="delete" title="Delete account"><i class="ti ti-trash"></i></button></div>'
        : '<span class="protected-account"><i class="ti ti-lock"></i> Protected</span>';
      var status = pending
        ? '<span class="account-status is-pending">Pending password</span>'
        : '<span class="account-status' + (user.active ? '' : ' is-disabled') + '">' + (user.active ? 'Active' : 'Disabled') + '</span>';
      var roleIcon = user.role === 'admin' ? 'ti-shield-check' : (marketing ? 'ti-speakerphone' : 'ti-id-badge-2');
      var accessTitle = user.role === 'admin'
        ? 'Full access'
        : (marketing ? escapeHtml(user.jobTitle || 'Onboarding only') : escapeHtml(user.jobTitle || 'Careers + onboarding'));
      var accessCopy = user.role === 'admin'
        ? 'All collections + accounts'
        : (marketing ? 'Employee onboarding deliverables' : 'Jobs, hiring tools, onboarding');
      return '<article class="user-row" data-user-id="' + escapeHtml(user.id) + '"><div class="user-identity">' + avatar + '<div><strong>' + escapeHtml(user.name) + '</strong>' + meta + '</div></div>' +
        '<span class="role-pill' + (managed ? (marketing ? ' is-marketing' : ' is-hr') : '') + '"><i class="ti ' + roleIcon + '"></i>' + escapeHtml(user.role) + '</span>' +
        '<div class="user-access"><strong>' + accessTitle + '</strong><small>' + accessCopy + '</small></div>' +
        '<div class="user-last-login"><small>Last login</small><strong>' + escapeHtml(user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never') + '</strong></div>' +
        '<div>' + status + '</div>' + actions + '</article>';
    }).join('');
  }

  function setUserModalRoleUi(role) {
    var marketing = role === 'marketing';
    state.editingUserRole = marketing ? 'marketing' : 'hr';
    var roleInput = $('#userRoleInput');
    if (roleInput) roleInput.value = state.editingUserRole;
    var chipTitle = $('#userRoleChipTitle');
    var chipCopy = $('#userRoleChipCopy');
    var chipIcon = $('#userRoleChipIcon');
    if (chipTitle) chipTitle.textContent = marketing ? 'Marketing access' : 'HR access';
    if (chipCopy) chipCopy.textContent = marketing ? 'Onboarding deliverables only' : 'Careers, hiring & onboarding';
    if (chipIcon) chipIcon.className = 'ti ' + (marketing ? 'ti-speakerphone' : 'ti-id-badge-2');
  }

  function openUserModal(id, preferredRole) {
    if (!isAdmin()) return;
    var user = id ? state.users.find(function (entry) { return entry.id === id; }) : null;
    if (user && user.role === 'admin') return;
    state.editingUserId = user ? user.id : null;
    var role = user ? user.role : (preferredRole === 'marketing' ? 'marketing' : 'hr');
    setUserModalRoleUi(role);
    var marketing = role === 'marketing';
    $('#userModalKicker').textContent = user
      ? (marketing ? 'EDIT MARKETING ACCOUNT' : 'EDIT HR ACCOUNT')
      : (marketing ? 'NEW MARKETING ACCOUNT' : 'NEW HR ACCOUNT');
    $('#userModalTitle').textContent = user
      ? (marketing ? 'Edit Marketing account' : 'Edit HR account')
      : (marketing ? 'Add Marketing account' : 'Add HR account');
    var subtitle = $('#userModalSubtitle');
    if (subtitle) {
      subtitle.textContent = user
        ? 'Update profile details. Leave password blank to keep the current one.'
        : 'Set an initial password now. They can change it later after signing in.';
    }
    var icon = $('#userModalIcon');
    if (icon) icon.className = user ? 'ti ti-user-edit' : 'ti ti-user-plus';
    $('#userForm [name="name"]').value = user ? user.name : '';
    $('#userForm [name="username"]').value = user ? user.username : '';
    $('#userForm [name="email"]').value = user ? (user.email || '') : '';
    $('#userForm [name="jobTitle"]').value = user ? (user.jobTitle || '') : '';
    $('#userForm [name="jobTitle"]').placeholder = marketing ? 'e.g. Marketing Specialist' : 'e.g. HR Specialist';
    $('#userForm [name="active"]').checked = user ? user.active : true;
    var passwordInput = $('#userForm [name="password"]');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.type = 'password';
      passwordInput.required = !user;
      passwordInput.placeholder = user ? 'Leave blank to keep current password' : 'Create a password';
    }
    var toggle = $('#userPasswordToggle');
    if (toggle) toggle.innerHTML = '<i class="ti ti-eye"></i>';
    $('#passwordRequirement').textContent = user ? 'Optional' : 'At least 10 characters';
    $('#passwordEditHint').textContent = user ? 'Leave blank to keep the current password.' : 'Required for new accounts. Share it securely.';
    var hint = $('#userPasswordHint');
    if (hint) {
      hint.classList.toggle('is-hidden', Boolean(user));
      hint.hidden = Boolean(user);
    }
    clearUserPhotoPreview();
    if (user && user.photo) setUserPhotoPreview(user.photo);
    $('#userModalBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#userForm [name="name"]').focus(); }, 120);
  }

  function closeUserModal() {
    $('#userModalBackdrop').classList.remove('is-open');
    state.editingUserId = null;
    $('#userForm').reset();
    clearUserPhotoPreview();
    setUserModalRoleUi('hr');
    var hint = $('#userPasswordHint');
    if (hint) {
      hint.hidden = false;
      hint.classList.remove('is-hidden');
    }
    if (!$('#changePasswordBackdrop').classList.contains('is-open')) document.body.style.overflow = '';
  }

  async function saveUser(event) {
    event.preventDefault();
    var button = $('#userForm button[type="submit"]');
    var name = $('#userForm [name="name"]').value.trim();
    var username = $('#userForm [name="username"]').value.trim();
    var email = $('#userForm [name="email"]').value.trim();
    var jobTitle = $('#userForm [name="jobTitle"]').value.trim();
    var photo = $('#userForm [name="photo"]').value.trim();
    var password = ($('#userForm [name="password"]') || {}).value || '';
    var editing = Boolean(state.editingUserId);
    if (!name) return toast('Enter the full name for this account.', true);
    if (!/^[A-Za-z0-9._-]{2,40}$/.test(username)) {
      return toast('Username must be 2–40 characters using letters, numbers, dots, dashes, or underscores (no spaces).', true);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid work email address.', true);
    if (!jobTitle) return toast('Enter a job title.', true);
    if (!editing && password.length < 10) return toast('Password must be at least 10 characters.', true);
    if (editing && password && password.length < 10) return toast('New password must be at least 10 characters, or leave it blank.', true);
    var payload = {
      name: name,
      username: username,
      email: email,
      jobTitle: jobTitle,
      photo: photo,
      role: state.editingUserRole || 'hr',
      active: $('#userForm [name="active"]').checked,
    };
    if (password) payload.password = password;
    try {
      setBusy(button, true);
      var url = '/api/admin/users' + (state.editingUserId ? '/' + encodeURIComponent(state.editingUserId) : '');
      var result = await api(url, { method: state.editingUserId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      state.users = result.users || state.users;
      closeUserModal();
      renderUsers();
      var roleLabel = (payload.role === 'marketing') ? 'Marketing' : 'HR';
      toast(editing
        ? (password ? roleLabel + ' account updated and password changed.' : 'The ' + roleLabel + ' account was updated.')
        : roleLabel + ' account created. Share the username and password so they can sign in.');
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  function openChangePasswordModal() {
    $('#changePasswordForm').reset();
    $('#changePasswordBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#changePasswordForm [name="currentPassword"]').focus(); }, 120);
  }

  function closeChangePasswordModal() {
    $('#changePasswordBackdrop').classList.remove('is-open');
    $('#changePasswordForm').reset();
    if (!$('#userModalBackdrop').classList.contains('is-open')) document.body.style.overflow = '';
  }

  async function saveChangePassword(event) {
    event.preventDefault();
    var button = $('#changePasswordForm button[type="submit"]');
    var currentPassword = $('#changePasswordForm [name="currentPassword"]').value;
    var password = $('#changePasswordForm [name="password"]').value;
    var passwordConfirm = $('#changePasswordForm [name="passwordConfirm"]').value;
    if (password.length < 10) return toast('New password must be at least 10 characters.', true);
    if (password !== passwordConfirm) return toast('Password confirmation does not match.', true);
    try {
      setBusy(button, true);
      var result = await api('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPassword, password: password, passwordConfirm: passwordConfirm }),
      });
      closeChangePasswordModal();
      toast(result.message || 'Password updated.');
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  function askUserDelete(id) {
    var user = state.users.find(function (entry) { return entry.id === id; });
    if (!user || user.role === 'admin') return;
    state.pendingDelete = { kind: 'user', id: id };
    var roleLabel = user.role === 'marketing' ? 'Marketing' : 'HR';
    $('#confirmTitle').textContent = 'Delete this ' + roleLabel + ' account?';
    $('#confirmText').textContent = '“' + user.name + '” will lose access immediately and all active sessions will be revoked.';
    $('#modalBackdrop').classList.add('is-open');
  }

  function isMobileSidebar() {
    return window.matchMedia('(max-width:900px)').matches;
  }

  function updateSidebarToggleUi() {
    var collapsed = $('#appShell').classList.contains('is-sidebar-collapsed');
    var mobileOpen = $('#sidebar').classList.contains('is-open');
    var expanded = isMobileSidebar() ? mobileOpen : !collapsed;
    var btn = $('#menuToggle');
    var icon = $('#menuToggleIcon');
    if (btn) {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.setAttribute('aria-label', expanded ? 'Close sidebar' : 'Open sidebar');
    }
    if (icon) {
      icon.className = 'ti ' + (expanded ? 'ti-layout-sidebar-left-collapse' : 'ti-layout-sidebar-left-expand');
    }
  }

  function openMobileMenu() {
    $('#sidebar').classList.add('is-open');
    $('#mobileOverlay').classList.add('is-open');
    updateSidebarToggleUi();
  }

  function closeMobileMenu() {
    $('#sidebar').classList.remove('is-open');
    $('#mobileOverlay').classList.remove('is-open');
    updateSidebarToggleUi();
  }

  function setSidebarCollapsed(collapsed) {
    $('#appShell').classList.toggle('is-sidebar-collapsed', Boolean(collapsed));
    try { localStorage.setItem('dh-sidebar-collapsed', collapsed ? '1' : '0'); } catch (_) {}
    updateSidebarToggleUi();
  }

  function toggleSidebar() {
    if (isMobileSidebar()) {
      if ($('#sidebar').classList.contains('is-open')) closeMobileMenu();
      else openMobileMenu();
      return;
    }
    setSidebarCollapsed(!$('#appShell').classList.contains('is-sidebar-collapsed'));
  }

  function restoreSidebarPreference() {
    if (isMobileSidebar()) return updateSidebarToggleUi();
    var collapsed = false;
    try { collapsed = localStorage.getItem('dh-sidebar-collapsed') === '1'; } catch (_) {}
    setSidebarCollapsed(collapsed);
  }

  function bindEvents() {
    $('#loginForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = $('#loginForm button[type="submit"]');
      $('#loginError').textContent = '';
      try {
        setBusy(button, true);
        var session = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: $('#loginUsername').value.trim(), password: $('#loginPassword').value }) });
        state.csrf = session.csrf;
        applySession(session);
        showApp();
        toast('Welcome back. Your content is ready.');
        try {
          await loadContent();
          await loadApplications();
          if (canUseOnboarding()) await loadOnboarding();
          if (isAdmin()) {
            await loadContactRequests();
            await loadUsers();
          }
          restoreAdminRoute();
        } catch (loadError) {
          toast(loadError.message || 'Signed in, but some content failed to load. Refresh if needed.', true);
        }
      } catch (error) { $('#loginError').textContent = error.message; }
      finally { setBusy(button, false); }
    });

    $('#setupPasswordForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = $('#setupPasswordForm button[type="submit"]');
      var password = $('#setupPassword').value;
      var confirm = $('#setupPasswordConfirm').value;
      $('#setupError').textContent = '';
      if (password.length < 10) return ($('#setupError').textContent = 'Password must be at least 10 characters.');
      if (password !== confirm) return ($('#setupError').textContent = 'Password confirmation does not match.');
      if (!state.setupToken) return ($('#setupError').textContent = 'This invite link is missing or invalid.');
      try {
        setBusy(button, true);
        var result = await api('/api/admin/auth/setup-password', {
          method: 'POST',
          body: JSON.stringify({ token: state.setupToken, password: password, passwordConfirm: confirm }),
        });
        state.setupToken = '';
        showLogin();
        if (result.username) $('#loginUsername').value = result.username;
        toast(result.message || 'Password saved. Sign in with your username.');
      } catch (error) { $('#setupError').textContent = error.message; }
      finally { setBusy(button, false); }
    });

    $('#passwordToggle').addEventListener('click', function () {
      var input = $('#loginPassword'); var hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password';
      this.innerHTML = '<i class="ti ' + (hidden ? 'ti-eye-off' : 'ti-eye') + '"></i>';
    });
    $('#setupPasswordToggle').addEventListener('click', function () {
      var input = $('#setupPassword'); var hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password';
      this.innerHTML = '<i class="ti ' + (hidden ? 'ti-eye-off' : 'ti-eye') + '"></i>';
    });

    function closeUserMenu() {
      var menu = $('#userMenu');
      var btn = $('#userMenuBtn');
      var dropdown = $('#userMenuDropdown');
      if (!menu || !btn || !dropdown) return;
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      dropdown.hidden = true;
    }

    function toggleUserMenu() {
      var menu = $('#userMenu');
      var btn = $('#userMenuBtn');
      var dropdown = $('#userMenuDropdown');
      if (!menu || !btn || !dropdown) return;
      var open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      dropdown.hidden = !open;
    }

    $('#userMenuBtn').addEventListener('click', function (event) {
      event.stopPropagation();
      toggleUserMenu();
    });
    document.addEventListener('click', function (event) {
      if (!$('#userMenu') || $('#userMenu').contains(event.target)) return;
      closeUserMenu();
    });

    $('#logoutBtn').addEventListener('click', async function () {
      closeUserMenu();
      try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch (_) {}
      state.csrf = ''; state.data = null; state.users = []; state.applications = []; state.contactRequests = []; state.currentUser = null; state.permissions = null; state.setupToken = ''; $('#loginPassword').value = ''; showLogin();
    });

    $$('.side-link').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.view === 'hrPortal') state.hrSelectedId = '';
        switchView(button.dataset.view || 'content', button.dataset.collection);
      });
    });
    document.addEventListener('click', function (event) {
      var link = event.target.closest('[data-view-link]');
      if (!link) return;
      if (link.dataset.dashHrFilter) {
        state.hrFilter = link.dataset.dashHrFilter;
        state.hrSelectedId = '';
      }
      if (link.dataset.onboardingFilter) {
        state.onboardingStatus = link.dataset.onboardingFilter;
      }
      switchView(link.dataset.viewLink, link.dataset.dashCollection || null);
    });
    document.addEventListener('click', function (event) {
      var startBtn = event.target.closest('[data-start-onboarding]');
      if (!startBtn) return;
      event.preventDefault();
      startOnboardingFromApplication(startBtn.dataset.startOnboarding);
    });
    var onboardingStatusFilter = $('#onboardingStatusFilter');
    if (onboardingStatusFilter) {
      onboardingStatusFilter.addEventListener('change', function () {
        state.onboardingStatus = this.value || 'all';
        renderOnboarding();
      });
    }
    var interviewLogSearch = $('#interviewLogSearch');
    if (interviewLogSearch) {
      interviewLogSearch.addEventListener('input', function () {
        readInterviewLogFiltersFromDom();
        renderInterviewLog();
      });
    }
    [
      'interviewLogResultFilter',
      'interviewLogRoleFilter',
      'interviewLogTypeFilter',
      'interviewLogFormatFilter',
      'interviewLogInterviewerFilter',
      'interviewLogFrom',
      'interviewLogTo',
      'interviewLogScoreFilter',
      'interviewLogStatusFilter',
      'interviewLogNotesFilter',
      'interviewLogRoundsFilter',
      'interviewLogActivityFilter'
    ].forEach(function (id) {
      var node = $('#' + id);
      if (!node) return;
      node.addEventListener('change', function () {
        readInterviewLogFiltersFromDom();
        renderInterviewLog();
      });
    });
    var interviewLogClear = $('#interviewLogClearFilters');
    if (interviewLogClear) {
      interviewLogClear.addEventListener('click', clearInterviewLogFilters);
    }
    var interviewLogList = $('#interviewLogList');
    if (interviewLogList) {
      interviewLogList.addEventListener('click', function (event) {
        var row = event.target.closest('[data-interview-log-id]');
        if (!row) return;
        state.interviewLogSelectedId = row.dataset.interviewLogId;
        renderInterviewLog();
      });
    }
    var interviewLogDetail = $('#interviewLogDetail');
    if (interviewLogDetail) {
      interviewLogDetail.addEventListener('click', function (event) {
        var open = event.target.closest('[data-open-pipeline]');
        if (!open) return;
        openHrPipeline(open.dataset.openPipeline);
      });
    }
    var onboardingList = $('#onboardingList');
    if (onboardingList) {
      onboardingList.addEventListener('click', function (event) {
        var row = event.target.closest('[data-onboarding-id]');
        if (!row) return;
        state.onboardingSelectedId = row.dataset.onboardingId;
        renderOnboarding();
      });
    }
    var onboardingDetail = $('#onboardingDetail');
    if (onboardingDetail) {
      onboardingDetail.addEventListener('submit', function (event) {
        if (event.target && event.target.id === 'onboardingForm') saveOnboarding(event);
      });
      onboardingDetail.addEventListener('change', function (event) {
        var input = event.target.closest('[data-onboarding-upload]');
        if (!input) return;
        uploadOnboardingAsset(input.files[0], input.dataset.onboardingUpload, input);
        input.value = '';
      });
    }
    $$('[data-quick-collection]').forEach(function (button) { button.addEventListener('click', function () { switchView('content', button.dataset.quickCollection); openEditor(); }); });
    $$('[data-quick-add]').forEach(function (button) { button.addEventListener('click', function () { switchView('content', isHr() ? 'jobs' : 'blogs'); openEditor(); }); });

    $('#addItemBtn').addEventListener('click', function () { openEditor(); });
    $('[data-empty-add]').addEventListener('click', function () { openEditor(); });
    $('.status-tabs').addEventListener('click', function (event) { var button = event.target.closest('[data-status]'); if (!button) return; state.currentStatus = button.dataset.status; renderCollection(); });
    $('#collectionSearch').addEventListener('input', function () { state.query = this.value; renderCollection(); });
    $('#applicationSearch').addEventListener('input', function () { state.applicationQuery = this.value; renderApplications(); });
    $('#applicationStatusFilter').addEventListener('change', function () { state.applicationStatus = this.value; renderApplications(); });
    $('#applicationExperienceFilter').addEventListener('change', function () { state.applicationExperience = this.value; renderApplications(); });
    $('#applicationNoticeFilter').addEventListener('change', function () { state.applicationNoticeMax = this.value; renderApplications(); });
    $('#applicationSalaryFilter').addEventListener('input', function () { state.applicationSalaryMax = this.value; renderApplications(); });
    $('#clearApplicationFilters').addEventListener('click', function () {
      resetApplicationSecondaryFilters();
      renderApplications();
    });
    $('#applicationVacancyCards').addEventListener('click', function (event) {
      var card = event.target.closest('[data-vacancy-role]');
      if (!card) return;
      if (state.applicationRole !== card.dataset.vacancyRole) resetApplicationSecondaryFilters();
      state.applicationRole = card.dataset.vacancyRole;
      renderApplications();
    });
    $('#applicationsList').addEventListener('change', function (event) { if (event.target.matches('[data-application-status]')) updateApplicationStatus(event.target); });
    $('#applicationsList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-open-pipeline]');
      if (!button) return;
      openHrPipeline(button.dataset.openPipeline, { enroll: true });
    });
    $('#dashboardView').addEventListener('click', function (event) {
      var pipelineBtn = event.target.closest('[data-open-pipeline]');
      if (pipelineBtn) {
        openHrPipeline(pipelineBtn.dataset.openPipeline);
        return;
      }
    });
    $('#hrPipelineList').addEventListener('click', function (event) {
      if (event.target.closest('a')) return;
      var button = event.target.closest('[data-open-pipeline]');
      var row = event.target.closest('[data-hr-row-id]');
      var id = button ? button.dataset.openPipeline : (row && row.dataset.hrRowId);
      if (!id) return;
      openHrPipeline(id);
    });
    $('#hrCandidateSearch').addEventListener('input', function () {
      state.hrQuery = this.value;
      renderHrPortal();
    });
    function syncAnalyticsFilters() {
      state.analyticsFrom = ($('#analyticsFrom') || {}).value || '';
      state.analyticsTo = ($('#analyticsTo') || {}).value || '';
      state.analyticsOutcome = ($('#analyticsOutcomeFilter') || {}).value || 'all';
      renderHrAnalytics();
    }
    $('#analyticsFrom').addEventListener('change', syncAnalyticsFilters);
    $('#analyticsTo').addEventListener('change', syncAnalyticsFilters);
    $('#analyticsOutcomeFilter').addEventListener('change', syncAnalyticsFilters);
    $('#analyticsClearRange').addEventListener('click', function () {
      state.analyticsFrom = '';
      state.analyticsTo = '';
      state.analyticsOutcome = 'all';
      if ($('#analyticsFrom')) $('#analyticsFrom').value = '';
      if ($('#analyticsTo')) $('#analyticsTo').value = '';
      if ($('#analyticsOutcomeFilter')) $('#analyticsOutcomeFilter').value = 'all';
      renderHrAnalytics();
    });
    $('#hrAnalyticsView').addEventListener('scroll', function (event) {
      var scroller = event.target.closest('[data-analytics-scroll]');
      if (!scroller || !scroller.dataset.analyticsScroll) return;
      if (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 48) return;
      appendAnalyticsPeopleRows(scroller.dataset.analyticsScroll);
    }, true);
    $('#calendarPrevMonth').addEventListener('click', function () {
      ensureCalendarState();
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
      renderHrCalendar();
    });
    $('#calendarNextMonth').addEventListener('click', function () {
      ensureCalendarState();
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
      renderHrCalendar();
    });
    $('#calendarTodayBtn').addEventListener('click', function () {
      var today = new Date();
      state.calendarMonth = calendarMonthStart(today);
      state.calendarSelectedDay = calendarDayKey(today);
      renderHrCalendar();
    });
    $('#calendarGrid').addEventListener('click', function (event) {
      var dayBtn = event.target.closest('[data-calendar-day]');
      if (!dayBtn) return;
      state.calendarSelectedDay = dayBtn.dataset.calendarDay || '';
      renderHrCalendar();
    });
    $('#calendarAgendaList').addEventListener('click', function (event) {
      var card = event.target.closest('[data-open-pipeline]');
      if (!card) return;
      openHrPipeline(card.dataset.openPipeline);
    });
    document.addEventListener('click', function (event) {
      var metric = event.target.closest('#hrMetrics [data-hr-filter]');
      if (!metric) return;
      state.hrFilter = metric.dataset.hrFilter;
      renderHrPortal();
    });
    $('#hrPipelineDetail').addEventListener('click', function (event) {
      var back = event.target.closest('[data-hr-back-list]');
      if (back) {
        state.hrSelectedId = '';
        renderHrPortal();
        return;
      }
      var taskDecisionBtn = event.target.closest('[data-task-decision]');
      if (taskDecisionBtn) {
        event.preventDefault();
        var decisionForm = $('#hrPipelineForm');
        if (!decisionForm || !state.hrSelectedId) return;
        var decisionItem = (state.applications || []).find(function (entry) { return entry.id === state.hrSelectedId; });
        if (!decisionItem) return;
        var decisionInput = $('[name="taskDecision"]', decisionForm);
        if (decisionInput) decisionInput.value = taskDecisionBtn.dataset.taskDecision || 'pending';
        if (taskDecisionBtn.dataset.taskDecision === 'approved') {
          var statusSelect = $('[name="taskStatus"]', decisionForm);
          if (statusSelect) statusSelect.value = 'done';
        }
        var decisionCurrent = pipelineOf(decisionItem);
        var decisionNext = collectPipelineFromForm(decisionForm);
        if (!(decisionNext.interviews && decisionNext.interviews.length) && decisionCurrent.interviews && decisionCurrent.interviews.length && decisionNext.task.decision !== 'rejected') {
          decisionNext.interviews = limitInterviewRounds(decisionCurrent.interviews);
        }
        if (decisionNext.task.decision === 'rejected') decisionNext.interviews = [];
        renderHrPipelineDetail(Object.assign({}, decisionItem, {
          pipeline: Object.assign({}, decisionCurrent, decisionNext, {
            stage: decisionNext.task.decision === 'rejected' ? 'closed' : (decisionNext.task.decision === 'approved' ? 'interview' : 'task')
          })
        }));
        return;
      }
      var addInterview = event.target.closest('[data-add-interview]');
      if (addInterview) {
        event.preventDefault();
        var list = $('[data-interview-list]', $('#hrPipelineDetail'));
        if (!list) return;
        var rows = $$('[data-interview-row]', list);
        if (rows.length) {
          var last = rows[rows.length - 1];
          var lastResult = ($('[name="result"]', last) || {}).value || 'pending';
          if (lastResult !== 'pass' && lastResult !== 'fail') {
            toast('Finish the current interview (Pass or Fail) before adding another.', true);
            return;
          }
          var lastScore = parseInterviewScore(($('[name="score"]', last) || {}).value);
          if (lastScore.empty || lastScore.invalid) {
            var lastScoreInput = $('[name="score"]', last);
            if (lastScoreInput) {
              lastScoreInput.classList.add('is-invalid');
              lastScoreInput.focus();
            }
            toast(lastScore.invalid
              ? 'Fix the current interview score (0–10, half points) before adding another.'
              : 'Add a score (0–10) for the current interview before adding another.', true);
            return;
          }
        }
        var existing = rows.map(function (row) {
          return { label: interviewLabelFromRow(row), result: ($('[name="result"]', row) || {}).value || 'pending' };
        });
        var item = (state.applications || []).find(function (entry) { return entry.id === state.hrSelectedId; });
        list.insertAdjacentHTML('beforeend', interviewRowHtml({
          id: '',
          label: nextInterviewLabel(existing, item),
          format: 'online',
          interviewer: '',
          interviewerUserId: '',
          scheduledAt: '',
          score: '',
          notes: '',
          result: 'pending'
        }, rows.length));
        refreshAddInterviewControl();
        return;
      }
      var removeInterview = event.target.closest('[data-remove-interview]');
      if (removeInterview) {
        event.preventDefault();
        var row = removeInterview.closest('[data-interview-row]');
        if (row) row.remove();
        refreshAddInterviewControl();
      }
    });
    $('#hrPipelineDetail').addEventListener('submit', function (event) {
      if (event.target.id === 'hrPipelineForm') saveHrPipeline(event);
    });
    $('#hrPipelineDetail').addEventListener('change', function (event) {
      if (event.target.matches('[name="interviewType"]')) {
        var interviewRow = event.target.closest('[data-interview-row]');
        var customWrap = interviewRow && $('[data-custom-label]', interviewRow);
        if (customWrap) customWrap.classList.toggle('is-hidden', event.target.value !== '__custom__');
        return;
      }
      if (event.target.matches('[name="result"]')) {
        var resultRow = event.target.closest('[data-interview-row]');
        if (resultRow) {
          resultRow.dataset.result = event.target.value;
          event.target.className = 'hr-result-select is-' + event.target.value;
          var scoreInput = $('[name="score"]', resultRow);
          if ((event.target.value === 'pass' || event.target.value === 'fail') && scoreInput && !String(scoreInput.value || '').trim()) {
            scoreInput.classList.add('is-invalid');
            toast('Add a score (0–10) before marking Pass or Fail.', true);
            scoreInput.focus();
          } else if (scoreInput) {
            markInterviewScoreValidity(scoreInput);
          }
        }
        refreshAddInterviewControl();
        return;
      }
      if (event.target.matches('[name="score"]')) {
        markInterviewScoreValidity(event.target);
        return;
      }
      if (event.target.matches('[name="phoneScreen"], [name="pathway"], [name="taskStatus"], [name="offerStatus"]')) {
        if (event.target.name === 'offerStatus') {
          var wrap = $('[data-decline-wrap]', $('#hrPipelineDetail'));
          if (wrap) wrap.classList.toggle('is-hidden', event.target.value !== 'declined');
          return;
        }
        var form = $('#hrPipelineForm');
        if (!form || !state.hrSelectedId) return;
        var item = (state.applications || []).find(function (entry) { return entry.id === state.hrSelectedId; });
        if (!item) return;
        var current = pipelineOf(item);
        var next = collectPipelineFromForm(form);
        if (!(next.interviews && next.interviews.length) && current.interviews && current.interviews.length) {
          next.interviews = limitInterviewRounds(current.interviews);
        }
        if (next.pathway === 'with_tasks' && !next.task.title && current.task) {
          next.task = Object.assign({}, current.task, next.task);
        }
        renderHrPipelineDetail(Object.assign({}, item, { pipeline: Object.assign({}, current, next) }));
      }
    });
    $('#contactSearch').addEventListener('input', function () { state.contactQuery = this.value; renderContactRequests(); });
    $('#contactStatusFilter').addEventListener('change', function () { state.contactStatus = this.value; renderContactRequests(); });
    $('#contactSituationFilter').addEventListener('change', function () { state.contactSituation = this.value; renderContactRequests(); });
    $('#clearContactFilters').addEventListener('click', function () {
      state.contactStatus = 'all';
      state.contactSituation = 'all';
      state.contactQuery = '';
      $('#contactStatusFilter').value = 'all';
      $('#contactSituationFilter').value = 'all';
      $('#contactSearch').value = '';
      renderContactRequests();
    });
    $('#contactRequestsList').addEventListener('change', function (event) { if (event.target.matches('[data-contact-status]')) updateContactStatus(event.target); });
    $$('[data-layout]').forEach(function (button) { button.addEventListener('click', function () { state.layout = button.dataset.layout; renderCollection(); }); });
    $('#contentGrid').addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]'); if (!button) return;
      var card = button.closest('[data-id]'); if (!card) return;
      var id = card.dataset.id;
      if (button.dataset.action === 'edit') openEditor(id);
      if (button.dataset.action === 'duplicate') duplicateItem(id);
      if (button.dataset.action === 'delete') askDelete(id);
      if (button.dataset.action === 'end-vacancy') askEndVacancy(id);
      if (button.dataset.action === 'up') moveItem(id, -1);
      if (button.dataset.action === 'down') moveItem(id, 1);
    });

    $('#dynamicFields').addEventListener('input', function (event) {
      if (event.target.closest('[data-richtext-editor]')) syncRichTextFields(event.target.closest('[data-richtext-field]'));
    });
    $('#dynamicFields').addEventListener('paste', handleRichTextPaste);
    $('#dynamicFields').addEventListener('blur', function (event) {
      if (event.target.closest && event.target.closest('[data-richtext-editor]')) syncRichTextFields(event.target.closest('[data-richtext-field]'));
    }, true);
    $('#itemForm').addEventListener('submit', saveItem);
    $('#closeDrawerBtn').addEventListener('click', closeEditor);
    $('#cancelDrawerBtn').addEventListener('click', closeEditor);
    $('#drawerBackdrop').addEventListener('click', closeEditor);
    $('#drawerDeleteBtn').addEventListener('click', function () { if (state.editingId) askDelete(state.editingId); });
    $('#dynamicFields').addEventListener('change', function (event) {
      if (event.target.matches('[data-image-upload]')) uploadImage(event.target.files[0], event.target);
      if (event.target.matches('[name="cluster"]') && state.currentCollection === 'blogs') refreshRelatedPosts();
    });
    $('#dynamicFields').addEventListener('click', function (event) {
      var richBtn = event.target.closest('[data-rich-cmd]');
      if (richBtn) {
        event.preventDefault();
        applyRichCommand(richBtn.dataset.richCmd, richBtn.dataset.richValue || '');
        return;
      }
      var removeImage = event.target.closest('[data-remove-image]');
      if (removeImage) {
        event.preventDefault();
        var imageField = removeImage.closest('.image-field') || $('#dynamicFields');
        var input = $('.image-path', imageField); if (input) input.value = '';
        var preview = $('.image-preview', imageField); if (preview) preview.remove();
        removeImage.remove();
        return;
      }
      if (event.target.closest('[data-add-faq]')) {
        var faqList = $('[data-faq-list]', $('#dynamicFields'));
        var faqIndex = $$('[data-faq-row]', faqList).length;
        var faqRow = document.createElement('div');
        faqRow.className = 'repeatable-row';
        faqRow.dataset.faqRow = '';
        faqRow.innerHTML = '<input name="faq[' + faqIndex + '].question" placeholder="Question" value=""><textarea name="faq[' + faqIndex + '].answer" rows="3" data-wordcount data-min-words="40" data-max-words="60" placeholder="Answer (40–60 words)"></textarea><small class="word-count">0 words</small><button type="button" class="card-action is-danger" data-remove-row>Remove</button>';
        faqList.appendChild(faqRow);
        return;
      }
      if (event.target.closest('[data-add-callout]')) {
        var calloutList = $('[data-callout-list]', $('#dynamicFields'));
        var calloutIndex = $$('[data-callout-row]', calloutList).length;
        var calloutRow = document.createElement('div');
        calloutRow.className = 'repeatable-row';
        calloutRow.dataset.calloutRow = '';
        calloutRow.innerHTML = '<input name="dataCallouts[' + calloutIndex + '].figure" placeholder="Figure / claim" value=""><input name="dataCallouts[' + calloutIndex + '].source" placeholder="Source" value=""><button type="button" class="card-action is-danger" data-remove-row>Remove</button>';
        calloutList.appendChild(calloutRow);
        return;
      }
      var removeRow = event.target.closest('[data-remove-row]');
      if (removeRow) {
        var row = removeRow.closest('.repeatable-row');
        if (row) row.remove();
      }
    });
    $('#dynamicFields').addEventListener('input', function (event) {
      if (event.target.matches('[data-charcount]')) {
        var charLabel = event.target.parentElement && event.target.parentElement.querySelector('[data-charcount-label]');
        if (!charLabel) return;
        var maxChars = Number(event.target.dataset.maxChars || 60);
        var chars = String(event.target.value || '').length;
        charLabel.textContent = charCountLabel(chars, maxChars);
        charLabel.style.color = chars > maxChars ? '#e56883' : '';
        return;
      }
      if (!event.target.matches('[data-wordcount]')) return;
      var label = event.target.parentElement && event.target.parentElement.querySelector('[data-wordcount-label], .word-count');
      if (!label) return;
      var min = Number(event.target.dataset.minWords || 40);
      var max = Number(event.target.dataset.maxWords || 60);
      var count = wordCount(event.target.value);
      if (event.target.dataset.wordcountFormat === 'body') {
        label.textContent = formatNumber(count) + ' words (target ' + formatNumber(min) + '-' + formatNumber(max) + ')';
        label.style.color = count < min ? '#e56883' : '';
        return;
      }
      label.textContent = count + ' words (target ' + min + '–' + max + ')';
      label.style.color = (count < min || count > max) ? '#e56883' : '';
    });

    $('#cancelConfirmBtn').addEventListener('click', closeConfirm);
    $('#confirmDeleteBtn').addEventListener('click', confirmDelete);
    $('#modalBackdrop').addEventListener('click', function (event) { if (event.target === this) closeConfirm(); });

    $('#pageSelector').addEventListener('click', function (event) { var button = event.target.closest('[data-page]'); if (!button) return; state.currentPage = button.dataset.page; renderPageSelector(); renderPageForm(); });
    $('#pageForm').addEventListener('submit', savePage);
    $('#pageForm [name="lead"]').addEventListener('input', updateCharCount);
    $('#pageForm').addEventListener('change', function (event) {
      if (event.target.matches('[data-image-upload]')) uploadImage(event.target.files[0], event.target);
    });
    $('#pageForm').addEventListener('click', function (event) {
      var removeImage = event.target.closest('[data-remove-image]');
      if (removeImage) {
        event.preventDefault();
        var imageField = removeImage.closest('.image-field') || $('#aboutHistoryFields');
        var input = $('.image-path', imageField); if (input) input.value = '';
        var preview = $('.image-preview', imageField); if (preview) preview.remove();
        removeImage.remove();
        return;
      }
      if (event.target.closest('[data-add-history]')) {
        var list = $('[data-history-list]', $('#pageForm'));
        if (!list) return;
        var index = $$('[data-history-row]', list).length;
        if (index >= 16) return toast('Maximum 16 timeline entries.', true);
        var row = document.createElement('div');
        row.className = 'repeatable-row';
        row.dataset.historyRow = '';
        row.innerHTML = '<strong style="display:block;margin-bottom:10px;font-size:11px;color:#8eb4d0">' + String(index + 1).padStart(2, '0') + ' · Timeline entry</strong>' +
          '<div style="display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px">' +
          '<input name="history.milestones[' + index + '].year" placeholder="Year" value="' + (2019 + index) + '" style="direction:ltr;text-align:left">' +
          '<input name="history.milestones[' + index + '].text" placeholder="Milestone description" value="">' +
          '</div>' +
          '<label class="image-field" style="display:block;margin-top:12px">' +
          '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif">' +
          '<div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop milestone image or click to browse</strong>' +
          '<small>PNG, JPG, WEBP — up to 5MB · converted to WebP</small>' +
          '<span class="image-size-hint"><b>1400 × 900 px</b><em>Landscape photo for this year</em></span></div>' +
          '</div><input class="image-path" type="hidden" name="history.milestones[' + index + '].image" value=""></label>' +
          '<input name="history.milestones[' + index + '].alt" placeholder="Accessible image description" value="" style="margin-top:8px">' +
          '<button type="button" class="card-action is-danger" data-remove-history-row style="margin-top:10px">Remove</button>';
        list.appendChild(row);
        return;
      }
      var removeRow = event.target.closest('[data-remove-history-row]');
      if (removeRow) {
        var historyRow = removeRow.closest('[data-history-row]');
        if (historyRow && $$('[data-history-row]', $('#pageForm')).length > 1) historyRow.remove();
      }
    });
    $('#previewPageBtn').addEventListener('click', function () { window.open(pageInfo[state.currentPage].url, '_blank', 'noopener'); });
    $('#exportBtn').addEventListener('click', exportContent);
    $('#importInput').addEventListener('change', function () { importContent(this.files[0]); });

    $('#addUserBtn').addEventListener('click', function () { openUserModal(null, 'hr'); });
    var addMarketingBtn = $('#addMarketingUserBtn');
    if (addMarketingBtn) {
      addMarketingBtn.addEventListener('click', function () { openUserModal(null, 'marketing'); });
    }
    $('#usersList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-user-action]'); if (!button) return;
      var row = button.closest('[data-user-id]'); if (!row) return;
      if (button.dataset.userAction === 'edit') openUserModal(row.dataset.userId);
      if (button.dataset.userAction === 'delete') askUserDelete(row.dataset.userId);
    });
    $('#userForm').addEventListener('submit', saveUser);
    $('#closeUserModalBtn').addEventListener('click', closeUserModal);
    $('#cancelUserModalBtn').addEventListener('click', closeUserModal);
    $('#userModalBackdrop').addEventListener('click', function (event) { if (event.target === this) closeUserModal(); });
    $('#userForm').addEventListener('change', function (event) {
      if (event.target.matches('[data-user-image-upload]')) uploadUserPhoto(event.target.files[0], event.target);
    });
    $('#userForm').addEventListener('click', function (event) {
      if (!event.target.closest('[data-remove-image]')) return;
      clearUserPhotoPreview();
    });
    var userPasswordToggle = $('#userPasswordToggle');
    if (userPasswordToggle) {
      userPasswordToggle.addEventListener('click', function () {
        var input = $('#userForm [name="password"]');
        if (!input) return;
        var hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        this.innerHTML = '<i class="ti ' + (hidden ? 'ti-eye-off' : 'ti-eye') + '"></i>';
      });
    }
    $('#changePasswordBtn').addEventListener('click', function () {
      closeUserMenu();
      openChangePasswordModal();
    });
    $('#changePasswordForm').addEventListener('submit', saveChangePassword);
    $('#closeChangePasswordBtn').addEventListener('click', closeChangePasswordModal);
    $('#cancelChangePasswordBtn').addEventListener('click', closeChangePasswordModal);
    $('#changePasswordBackdrop').addEventListener('click', function (event) { if (event.target === this) closeChangePasswordModal(); });

    $('#globalSearch').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !this.value.trim()) return;
      var query = this.value.trim().toLowerCase();
      var match = Object.keys(collectionInfo).find(function (key) { return (state.data.collections[key] || []).some(function (item) { return JSON.stringify(item).toLowerCase().indexOf(query) > -1; }); });
      if (!match) return toast('No content matched this search.', true);
      switchView('content', match); state.query = this.value.trim(); $('#collectionSearch').value = state.query; renderCollection();
    });
    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); }
      if (event.key === 'Escape') {
        if ($('#userMenu') && $('#userMenu').classList.contains('is-open')) closeUserMenu();
        else if ($('#changePasswordBackdrop').classList.contains('is-open')) closeChangePasswordModal();
        else if ($('#userModalBackdrop').classList.contains('is-open')) closeUserModal();
        else if ($('#modalBackdrop').classList.contains('is-open')) closeConfirm();
        else if ($('#editorDrawer').classList.contains('is-open')) closeEditor();
        else closeMobileMenu();
      }
    });
    window.addEventListener('hashchange', function () {
      if (state._syncingRoute || $('#appShell').classList.contains('is-hidden')) return;
      restoreAdminRoute();
    });
    $('#menuToggle').addEventListener('click', toggleSidebar);
    $('#mobileOverlay').addEventListener('click', closeMobileMenu);
    window.addEventListener('resize', function () {
      if (!isMobileSidebar()) {
        closeMobileMenu();
        restoreSidebarPreference();
      } else {
        $('#appShell').classList.remove('is-sidebar-collapsed');
        updateSidebarToggleUi();
      }
    });
  }

  bindEvents();
  bootstrap();
  restoreSidebarPreference();
})();
