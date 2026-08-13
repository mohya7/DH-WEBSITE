(function () {
  'use strict';

  var collectionInfo = {
    services: { title: 'Services', singular: 'service', description: 'Manage the core service cards and Digital Hub capabilities.', icon: 'ti-stack-2', color: '#2ca8ea' },
    caseStudies: { title: 'Case Studies', singular: 'case study', description: 'Manage project outcomes shown on the homepage and work pages.', icon: 'ti-briefcase', color: '#f29a32' },
    blogs: { title: 'Blog', singular: 'article', description: 'Manage article body, cluster, FAQ, and static page output.', icon: 'ti-news', color: '#8f78ed' },
    partners: { title: 'Partners', singular: 'partner', description: 'Manage technology partners, logos, summaries, and page links.', icon: 'ti-building-skyscraper', color: '#36c99a' },
    jobs: { title: 'Careers', singular: 'job opening', description: 'Manage open roles, locations, departments, and contract types.', icon: 'ti-id-badge-2', color: '#e56883' },
    team: { title: 'Leadership Team', singular: 'team member', description: 'Manage leadership profiles, contact details, and display order.', icon: 'ti-users-group', color: '#4fb3d7' }
  };

  var schemas = {
    services: [
      { name: 'title', label: 'Service name', required: true, full: true, placeholder: 'Enterprise Software Solutions' },
      { name: 'summary', label: 'Short description', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'icon', label: 'Tabler icon', direction: 'ltr', placeholder: 'ti-stack-2' },
      { name: 'visual', label: 'Visual style', type: 'select', options: [['code', 'Code'], ['data', 'Data'], ['ai', 'Artificial Intelligence'], ['team', 'Team']] }
    ],
    caseStudies: [
      { name: 'title', label: 'Outcome headline', required: true, full: true },
      { name: 'summary', label: 'Case study summary', type: 'textarea', required: true, full: true, max: 900 },
      { name: 'image', label: 'Card image', type: 'image', full: true, imageSize: '1600 × 1000 px', imageNote: '16:10 landscape' },
      { name: 'alt', label: 'Accessible image description', full: true },
      { name: 'metric', label: 'Featured metric', placeholder: '500+ endpoints' },
      { name: 'categories', label: 'Categories', full: true, placeholder: 'data-analytics, enterprise-software', hint: 'Separate categories with commas.' }
    ],
    blogs: [
      { name: 'title', label: 'Article title', required: true, full: true },
      { name: 'summary', label: 'Card summary', type: 'textarea', required: true, full: true, max: 700, hint: 'Short blurb for cards and listings — not the answer block.' },
      { name: 'cluster', label: 'Cluster', type: 'select', required: true, full: true, options: [
        ['DEX & Digital Employee Experience', 'DEX & Digital Employee Experience'],
        ['Enterprise Software', 'Enterprise Software'],
        ['Data, Cloud & Digital Egypt 2030', 'Data, Cloud & Digital Egypt 2030'],
        ['AI & Automation', 'AI & Automation'],
        ['Technical Talent & Outsourcing', 'Technical Talent & Outsourcing']
      ] },
      { name: 'answerBlock', label: 'Answer block (40–60 words)', type: 'wordcount', full: true, minWords: 40, maxWords: 60, max: 2000 },
      { name: 'body', label: 'Article body (HTML)', type: 'html', full: true, hint: 'Use H2 headings for the table of contents. Body is the source of truth for the static page.' },
      { name: 'faq', label: 'FAQ (min 5 before publish)', type: 'faq', full: true },
      { name: 'dataCallouts', label: 'Data callouts', type: 'callouts', full: true },
      { name: 'relatedPosts', label: 'Related posts (same cluster, max 3)', type: 'related', full: true },
      { name: 'comparisonTable', label: 'Comparison table (required for vs titles)', type: 'comparison', full: true },
      { name: 'image', label: 'Cover image', type: 'image', full: true, imageSize: '1620 × 1000 px', imageNote: 'Wide landscape' },
      { name: 'category', label: 'Filter category', type: 'select', options: [['enterprise-software', 'Enterprise Software'], ['data-analytics', 'Data & Analytics'], ['ai-automation', 'AI & Automation'], ['outsourcing', 'Outsourcing']] },
      { name: 'categoryLabel', label: 'Visible category label', placeholder: 'Enterprise Software' },
      { name: 'accent', label: 'Category color', type: 'select', options: [['blue', 'Blue'], ['orange', 'Orange']] },
      { name: 'readTime', label: 'Reading time (auto)', type: 'readonly', hint: 'Derived from word count at 225 wpm on save.' }
    ],
    partners: [
      { name: 'name', label: 'Partner name', required: true, full: true },
      { name: 'summary', label: 'Partnership summary', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'image', label: 'Partner logo', type: 'image', full: true, imageSize: '1200 × 400 px', imageNote: 'Transparent PNG preferred' },
      { name: 'variant', label: 'Logo treatment', type: 'select', options: [['default', 'Default'], ['ms', 'Microsoft / Wide']] }
    ],
    jobs: [
      { name: 'title', label: 'Job title', required: true, full: true },
      { name: 'summary', label: 'Role summary', type: 'textarea', required: true, full: true, max: 700 },
      { name: 'department', label: 'Department', placeholder: 'Engineering' },
      { name: 'type', label: 'Contract type', placeholder: 'Full time' },
      { name: 'location', label: 'Location', placeholder: 'Cairo, New Cairo' }
    ],
    team: [
      { name: 'name', label: 'Team member name', required: true, full: true },
      { name: 'role', label: 'Role', required: true },
      { name: 'image', label: 'Profile photo', type: 'image', full: true, imageSize: '800 × 1000 px', imageNote: '4:5 portrait' },
      { name: 'email', label: 'Email address', type: 'email', direction: 'ltr' },
      { name: 'linkedin', label: 'LinkedIn profile', direction: 'ltr', placeholder: 'https://linkedin.com/in/...' }
    ]
  };

  var autoLinkedCollections = ['services', 'caseStudies', 'blogs', 'partners', 'jobs'];

  var pageInfo = {
    home: { title: 'Homepage', icon: 'ti-home', url: '../index.html' },
    blogs: { title: 'Blog', icon: 'ti-news', url: '../blogs/index.html' },
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
    currentPage: 'home',
    applicationStatus: 'all',
    applicationQuery: '',
    applicationRole: '',
    applicationExperience: 'all',
    applicationNoticeMax: 'all',
    applicationSalaryMax: '',
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

  function allowedCollections() {
    return state.permissions ? state.permissions.collections : [];
  }

  function applySession(session) {
    state.currentUser = session.user;
    state.permissions = session.permissions;
    if (!isAdmin()) {
      state.currentCollection = 'jobs';
      state.currentPage = 'careers';
    }
    state.currentView = 'dashboard';
    $$('.view').forEach(function (node) { node.classList.toggle('is-active', node.id === 'dashboardView'); });
    $$('[data-admin-only]').forEach(function (node) { node.classList.toggle('role-hidden', !isAdmin()); });
    $('#currentUserName').textContent = state.currentUser.name || state.currentUser.username;
    $('#currentUserRole').textContent = isAdmin() ? 'Administrator' : 'HR · Careers editor';
    $('#currentUserAvatar').textContent = (state.currentUser.name || state.currentUser.username).split(/\s+/).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var welcomeTitle = $('.welcome-row h1');
    var welcomeText = $('.welcome-row p');
    if (welcomeTitle) welcomeTitle.innerHTML = isAdmin() ? 'Good morning <span>👋</span>' : 'Welcome, HR team <span>👋</span>';
    if (welcomeText) welcomeText.textContent = isAdmin() ? 'Every website card and headline, organized in one place.' : 'Manage job openings and Careers page content from one focused workspace.';
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
    if (response.status === 401 && url !== '/api/admin/login') {
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

  function showLogin() {
    $('#loginShell').classList.remove('is-hidden');
    $('#appShell').classList.add('is-hidden');
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
    var payload = await api('/api/admin/applications');
    state.applications = payload.applications || [];
    renderApplications();
  }

  async function loadContactRequests() {
    if (!isAdmin()) return;
    var payload = await api('/api/admin/contact-requests');
    state.contactRequests = payload.requests || [];
    renderContactRequests();
  }

  async function bootstrap() {
    try {
      var session = await api('/api/admin/session');
      if (!session.authenticated) return showLogin();
      state.csrf = session.csrf;
      applySession(session);
      await loadContent();
      await loadApplications();
      await loadContactRequests();
      await loadUsers();
      showApp();
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
    renderApplications();
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

  function renderDashboard() {
    var entries = allItems();
    var published = entries.filter(function (entry) { return entry.item.status === 'published'; }).length;
    var drafts = entries.length - published;
    var percent = entries.length ? Math.round(published / entries.length * 100) : 0;
    $('#statTotal').textContent = entries.length;
    $('#statPublished').textContent = published;
    $('#statDrafts').textContent = drafts;
    $('#statUpdated').textContent = formatDate(state.data.meta.updatedAt, false);
    $('#statUpdatedBy').textContent = 'By ' + (state.data.meta.updatedBy || 'system');
    $('#publishedRing').style.setProperty('--ring', percent + '%');
    $('#publishedRing').querySelector('span').textContent = percent + '%';

    var actions = { create: ['ti-plus', ''], update: ['ti-pencil', ''], delete: ['ti-trash', ' activity-icon--delete'], upload: ['ti-photo-up', ' activity-icon--upload'], import: ['ti-database-import', ' activity-icon--upload'], 'page-update': ['ti-file-pencil', ''] };
    var audit = (state.data.meta.audit || []).slice(0, 6);
    $('#activityList').innerHTML = audit.length ? audit.map(function (event) {
      var action = actions[event.action] || ['ti-history', ''];
      return '<article class="activity-item"><span class="activity-icon' + action[1] + '"><i class="ti ' + action[0] + '"></i></span><div><strong>' + escapeHtml(event.label) + '</strong><small>' + escapeHtml(event.by || 'system') + '</small></div><span class="activity-time">' + escapeHtml(relativeTime(event.at)) + '</span></article>';
    }).join('') : '<div class="empty-state"><p>No activity has been recorded yet.</p></div>';

    var available = allowedCollections();
    var max = Math.max(1, ...available.map(function (key) { return (state.data.collections[key] || []).length; }));
    $('#distributionChart').innerHTML = available.map(function (key) {
      var info = collectionInfo[key];
      var count = (state.data.collections[key] || []).length;
      return '<div class="dist-row"><div class="dist-head"><span>' + escapeHtml(info.title) + '</span><strong>' + count + '</strong></div><div class="dist-track"><i style="--size:' + Math.max(4, Math.round(count / max * 100)) + '%;--bar:' + info.color + '"></i></div></div>';
    }).join('');
  }

  function switchView(view, collection) {
    if (!isAdmin() && (view === 'users' || view === 'tools' || view === 'contactRequests')) return toast('Your HR account does not have access to this section.', true);
    if (collection && allowedCollections().indexOf(collection) === -1) return toast('Your HR account can only manage Careers content.', true);
    if (collection) {
      state.currentCollection = collection;
      state.currentStatus = 'all';
      state.query = '';
      $('#collectionSearch').value = '';
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
    if (view === 'contactRequests') renderContactRequests();
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function itemMedia(item, collection) {
    if (item.image) {
      var logo = collection === 'partners' ? ' is-logo' : '';
      return '<div class="content-card__media' + logo + '"><img src="' + escapeHtml(publicUrl(item.image)) + '" alt=""></div>';
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
    if (collection === 'team') values = [['ti-briefcase', item.role], ['ti-mail', item.email]];
    if (collection === 'services') values = [['ti-link', item.href]];
    if (collection === 'partners') values = [['ti-link', item.href]];
    return values.filter(function (entry) { return entry[1]; }).slice(0, 3).map(function (entry) {
      return '<span><i class="ti ' + entry[0] + '"></i>' + escapeHtml(entry[1]) + '</span>';
    }).join('');
  }

  function renderCollection() {
    if (!state.data) return;
    var info = collectionInfo[state.currentCollection];
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
    $('#contentGrid').classList.toggle('is-list', state.layout === 'list');
    $$('[data-layout]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.layout === state.layout); });

    $('#contentGrid').innerHTML = filtered.map(function (item, index) {
      var status = item.status === 'draft' ? [' is-draft', 'Draft'] : ['', 'Published'];
      return '<article class="content-card" data-id="' + escapeHtml(item.id) + '">' + itemMedia(item, state.currentCollection) +
        '<span class="content-status' + status[0] + '">' + status[1] + '</span>' + (item.featured ? '<span class="featured-star" title="Featured"><i class="ti ti-star-filled"></i></span>' : '') +
        '<div class="content-card__body"><span class="content-card__type">' + escapeHtml(info.singular) + '</span><h3>' + escapeHtml(titleOf(item)) + '</h3><p>' + escapeHtml(item.summary || item.role || item.department || '') + '</p><div class="content-meta">' + itemMeta(item, state.currentCollection) + '</div></div>' +
        '<footer class="content-card__foot"><button class="edit-btn" type="button" data-action="edit"><i class="ti ti-pencil"></i> Edit</button><button class="card-action" type="button" data-action="duplicate" title="Duplicate"><i class="ti ti-copy"></i></button>' +
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

  function fieldHtml(field, item) {
    var value = item && item[field.name] != null ? item[field.name] : '';
    if (field.name === 'categories' && Array.isArray(value)) value = value.join(', ');
    var required = field.required ? ' required' : '';
    var direction = field.direction ? ' style="direction:' + field.direction + ';text-align:left"' : '';
    var full = field.full ? ' dynamic-field--full' : '';
    var fieldMeta = field.required ? 'Required' : (field.type === 'image' ? field.imageSize : '');
    var label = '<span>' + escapeHtml(field.label) + (fieldMeta ? ' <em>' + escapeHtml(fieldMeta) + '</em>' : '') + '</span>';
    if (field.type === 'image') {
      return '<label class="dynamic-field image-field">' + label + '<div class="image-drop"><input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif"><div class="image-drop__empty"><i class="ti ti-cloud-upload"></i><strong>Drop an image or click to browse</strong><small>PNG, JPG, WEBP — up to 5MB</small><span class="image-size-hint"><b>' + escapeHtml(field.imageSize || 'Use a high-resolution image') + '</b>' + (field.imageNote ? '<em>' + escapeHtml(field.imageNote) + '</em>' : '') + '</span></div>' +
        (value ? '<img class="image-preview" src="' + escapeHtml(publicUrl(value)) + '" alt="Preview"><button class="image-remove" type="button" data-remove-image><i class="ti ti-x"></i></button>' : '') + '</div><input class="image-path" name="' + field.name + '" value="' + escapeHtml(value) + '" placeholder="assets/path/image.jpg"' + direction + '></label>';
    }
    if (field.type === 'readonly') {
      return '<label class="dynamic-field' + full + '">' + label + '<input name="' + field.name + '" type="text" value="' + escapeHtml(value || '—') + '" readonly>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
    }
    if (field.type === 'wordcount') {
      var count = wordCount(value);
      return '<label class="dynamic-field' + full + '">' + label + '<textarea name="' + field.name + '" rows="4" maxlength="' + (field.max || 2000) + '" data-wordcount data-min-words="' + (field.minWords || 40) + '" data-max-words="' + (field.maxWords || 60) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + required + direction + '>' + escapeHtml(value) + '</textarea><small class="word-count" data-wordcount-label>' + count + ' words (target ' + (field.minWords || 40) + '–' + (field.maxWords || 60) + ')</small></label>';
    }
    if (field.type === 'html') {
      return '<label class="dynamic-field' + full + '">' + label + '<textarea name="' + field.name + '" rows="16" class="html-body" placeholder="<h2>...</h2><p>...</p>"' + direction + '>' + escapeHtml(value) + '</textarea>' + (field.hint ? '<small>' + escapeHtml(field.hint) + '</small>' : '') + '</label>';
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
      var cluster = item && item.cluster;
      var options = ((state.data && state.data.collections.blogs) || []).filter(function (post) {
        return post.id !== (item && item.id) && (!cluster || post.cluster === cluster);
      });
      return '<div class="dynamic-field' + full + '">' + label + '<div class="related-list">' + (options.length ? options.map(function (post) {
        return '<label class="related-option"><input type="checkbox" name="relatedPosts" value="' + escapeHtml(post.id) + '"' + (selected.indexOf(post.id) > -1 ? ' checked' : '') + '> ' + escapeHtml(post.title) + '</label>';
      }).join('') : '<small>No other posts in this cluster yet.</small>') + '</div><small>Select up to 3 siblings in the same cluster.</small></div>';
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
    $('#editorDrawer').classList.add('is-open');
    $('#editorDrawer').setAttribute('aria-hidden', 'false');
    $('#drawerBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var first = $('#dynamicFields input, #dynamicFields textarea'); if (first) first.focus(); }, 250);
  }

  function closeEditor() {
    $('#editorDrawer').classList.remove('is-open');
    $('#editorDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerBackdrop').classList.remove('is-open');
    document.body.style.overflow = '';
    state.editingId = null;
    $('#itemForm').reset();
  }

  async function saveItem(event) {
    event.preventDefault();
    var button = $('#itemForm button[type="submit"]');
    var existing = state.editingId ? state.data.collections[state.currentCollection].find(function (entry) { return entry.id === state.editingId; }) : null;
    var payload = {};
    schemas[state.currentCollection].forEach(function (field) {
      if (field.type === 'faq' || field.type === 'callouts' || field.type === 'related' || field.type === 'comparison' || field.type === 'readonly') return;
      var input = $('#itemForm [name="' + field.name + '"]');
      if (!input) return;
      if (field.type === 'number') payload[field.name] = Number(input.value || 0);
      else if (field.name === 'categories') payload[field.name] = input.value.split(',').map(function (value) { return value.trim(); }).filter(Boolean);
      else payload[field.name] = input.value.trim();
    });
    if (state.currentCollection === 'blogs') {
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

  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image size must be under 5MB.', true);
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        toast('Uploading image...');
        var result = await api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl: reader.result }) });
        state.data.meta.revision = result.revision;
        var pathInput = $('.image-path', $('#dynamicFields'));
        if (pathInput) pathInput.value = result.path;
        var drop = $('.image-drop', $('#dynamicFields'));
        if (drop) {
          var old = $('.image-preview', drop); if (old) old.remove();
          var image = document.createElement('img'); image.className = 'image-preview'; image.src = '../' + result.path; image.alt = 'Preview'; drop.appendChild(image);
          if (!$('[data-remove-image]', drop)) { var remove = document.createElement('button'); remove.className = 'image-remove'; remove.type = 'button'; remove.dataset.removeImage = ''; remove.innerHTML = '<i class="ti ti-x"></i>'; drop.appendChild(remove); }
        }
        toast('Image uploaded. Save the card to apply it.');
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

  function askDelete(id) {
    var item = state.data.collections[state.currentCollection].find(function (entry) { return entry.id === id; });
    if (!item) return;
    state.pendingDelete = { kind: 'content', collection: state.currentCollection, id: id };
    $('#confirmTitle').textContent = 'Delete this content?';
    $('#confirmText').textContent = '“' + titleOf(item) + '” will be removed from the admin panel and the website. This action cannot be undone.';
    $('#modalBackdrop').classList.add('is-open');
  }

  function closeConfirm() {
    $('#modalBackdrop').classList.remove('is-open');
    state.pendingDelete = null;
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
        toast('The HR account was deleted and all active sessions were revoked.');
        return;
      }
      state.data = await api('/api/admin/items/' + pending.collection + '/' + encodeURIComponent(pending.id), { method: 'DELETE' });
      closeConfirm(); closeEditor(); renderAll(); toast('The content was removed from the website.');
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

  function renderPageForm() {
    if (!state.data || !state.data.pages[state.currentPage]) return;
    var page = state.data.pages[state.currentPage];
    $('#pageFormTitle').textContent = pageInfo[state.currentPage].title;
    $('.form-page-icon i').className = 'ti ' + pageInfo[state.currentPage].icon;
    ['label', 'title', 'lead', 'sectionTitle', 'sectionLead', 'seoTitle'].forEach(function (name) {
      var input = $('#pageForm [name="' + name + '"]');
      if (input) input.value = page[name] || '';
    });
    $('.seo-only').classList.toggle('is-hidden', state.currentPage !== 'home');
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
    new FormData($('#pageForm')).forEach(function (value, key) { payload[key] = String(value).trim(); });
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
    return weeks + (weeks === 1 ? ' week' : ' weeks');
  }

  function salaryLabel(item) {
    var value = item.expectedSalary != null && item.expectedSalary !== '' ? item.expectedSalary : item.expectedSalaryRange;
    return applicationValue(value, 'K EGP');
  }

  function renderApplicationFilterOptions(list) {
    var experienceSelect = $('#applicationExperienceFilter');
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
    var previousScroll = rail.scrollLeft;
    var jobs = state.data && state.data.collections ? (state.data.collections.jobs || []).filter(function (job) { return job.status === 'published'; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); }) : [];
    var cards = [{ title: 'All applications', role: 'all', department: 'Complete inbox', location: '', count: list.length }].concat(jobs.map(function (job) {
      return { title: job.title, role: job.title, department: job.department || 'Open vacancy', location: job.location || '', count: list.filter(function (item) { return item.role === job.title; }).length };
    }));
    rail.innerHTML = cards.map(function (card) {
      var active = state.applicationRole === card.role;
      return '<button class="vacancy-card' + (active ? ' is-active' : '') + '" type="button" aria-pressed="' + active + '" data-vacancy-role="' + escapeHtml(card.role) + '"><span class="vacancy-card__icon"><i class="ti ' + (card.role === 'all' ? 'ti-briefcase-2' : 'ti-user-search') + '"></i></span><span class="vacancy-card__copy"><small>' + escapeHtml(card.department) + '</small><strong>' + escapeHtml(card.title) + '</strong><em>' + escapeHtml(card.location) + '</em></span><span class="vacancy-card__count"><b>' + card.count + '</b><small>applicants</small></span><i class="ti ti-chevron-right vacancy-card__arrow"></i></button>';
    }).join('');
    rail.scrollLeft = previousScroll;
    window.requestAnimationFrame(updateVacancyScrollControls);
  }

  function updateVacancyScrollControls() {
    var rail = $('#applicationVacancyCards');
    var controls = $('#vacancyScrollControls');
    if (!rail || !controls) return;
    var overflow = rail.scrollWidth > rail.clientWidth + 2;
    controls.classList.toggle('is-hidden', !overflow);
    $('#vacancyScrollPrev').disabled = !overflow || rail.scrollLeft <= 2;
    $('#vacancyScrollNext').disabled = !overflow || rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
  }

  function scrollVacancies(direction) {
    var rail = $('#applicationVacancyCards');
    var card = $('.vacancy-card', rail);
    if (!rail || !card) return;
    rail.scrollBy({ left: direction * (card.offsetWidth + 12), behavior: 'smooth' });
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
    renderVacancyCards(list);
    var newCount = list.filter(function (item) { return item.status === 'new'; }).length;
    var progressCount = list.filter(function (item) { return item.status === 'reviewing' || item.status === 'contacted'; }).length;
    $$('[data-application-count]').forEach(function (node) { node.textContent = newCount; node.classList.toggle('is-zero', newCount === 0); });
    $('#applicationsTotal').textContent = list.length;
    $('#applicationsNew').textContent = newCount;
    $('#applicationsProgress').textContent = progressCount;

    var vacancySelected = Boolean(state.applicationRole);
    $('#applicationSecondaryFilters').classList.toggle('is-hidden', !vacancySelected);
    $('#applicationsPickPrompt').classList.toggle('is-hidden', vacancySelected);
    if (!vacancySelected) {
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
    $('#applicationsEmpty').classList.toggle('is-hidden', filtered.length > 0);
    $('#applicationsList').classList.toggle('is-hidden', filtered.length === 0);
    $('#applicationsList').innerHTML = filtered.map(function (item) {
      var status = item.status || 'new';
      var statusOptions = [['new', 'New'], ['reviewing', 'Reviewing'], ['contacted', 'Contacted'], ['rejected', 'Rejected']];
      var select = statusOptions.map(function (option) { return '<option value="' + option[0] + '"' + (option[0] === status ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('');
      return '<article class="panel application-card" data-application-id="' + escapeHtml(item.id) + '">' +
        '<header><span class="application-avatar">' + escapeHtml(applicationInitials(item.fullName)) + '</span><div><span class="application-role">' + escapeHtml(item.role) + '</span><h2>' + escapeHtml(item.fullName) + '</h2><p>Reference ' + escapeHtml(item.reference || item.id.replace('application-', '').slice(0, 8).toUpperCase()) + ' · Submitted ' + escapeHtml(formatDate(item.submittedAt, true)) + '</p></div><label class="application-status application-status--' + escapeHtml(status) + '"><span>Status</span><select data-application-status>' + select + '</select></label></header>' +
        '<div class="application-details"><div><small>Email</small><a href="mailto:' + encodeURIComponent(item.email) + '">' + escapeHtml(item.email) + '</a></div><div><small>Phone</small><a href="tel:' + encodeURIComponent(item.phone) + '">' + escapeHtml(item.phone) + '</a></div><div><small>Experience</small><strong>' + applicationValue(item.yearsOfExperience, ' years') + '</strong></div><div><small>Current salary</small><strong>' + applicationValue(item.currentSalary, 'K EGP') + '</strong></div><div><small>Expected salary</small><strong>' + salaryLabel(item) + '</strong></div><div><small>Notice period</small><strong>' + escapeHtml(noticeLabel(item)) + '</strong></div></div>' +
        '<footer><a class="secondary-btn" href="' + escapeHtml(item.linkedin) + '" target="_blank" rel="noopener"><i class="ti ti-brand-linkedin"></i> LinkedIn</a><a class="primary-btn" href="/api/admin/applications/' + encodeURIComponent(item.id) + '/resume"><i class="ti ti-download"></i> Download CV</a></footer></article>';
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

  function renderUsers() {
    if (!isAdmin()) return;
    var hrUsers = state.users.filter(function (user) { return user.role === 'hr'; });
    $('#usersTotal').textContent = state.users.length;
    $('#usersActive').textContent = hrUsers.filter(function (user) { return user.active; }).length;
    $('#usersDisabled').textContent = hrUsers.filter(function (user) { return !user.active; }).length;
    $$('[data-user-count]').forEach(function (node) { node.textContent = hrUsers.length; });
    $('#usersList').innerHTML = state.users.slice().sort(function (a, b) {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(function (user) {
      var hr = user.role === 'hr';
      var actions = hr
        ? '<div class="user-actions"><button class="card-action" type="button" data-user-action="edit" title="Edit account"><i class="ti ti-pencil"></i></button><button class="card-action is-danger" type="button" data-user-action="delete" title="Delete account"><i class="ti ti-trash"></i></button></div>'
        : '<span class="protected-account"><i class="ti ti-lock"></i> Protected</span>';
      return '<article class="user-row" data-user-id="' + escapeHtml(user.id) + '"><div class="user-identity"><span class="account-avatar' + (hr ? ' is-hr' : '') + '">' + escapeHtml(accountInitials(user)) + '</span><div><strong>' + escapeHtml(user.name) + '</strong><small>@' + escapeHtml(user.username) + '</small></div></div>' +
        '<span class="role-pill' + (hr ? ' is-hr' : '') + '"><i class="ti ' + (hr ? 'ti-id-badge-2' : 'ti-shield-check') + '"></i>' + escapeHtml(user.role) + '</span>' +
        '<div class="user-access"><strong>' + (hr ? 'Careers only' : 'Full access') + '</strong><small>' + (hr ? 'Jobs + Careers page copy' : 'All collections + accounts') + '</small></div>' +
        '<div class="user-last-login"><small>Last login</small><strong>' + escapeHtml(user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never') + '</strong></div>' +
        '<div><span class="account-status' + (user.active ? '' : ' is-disabled') + '">' + (user.active ? 'Active' : 'Disabled') + '</span></div>' + actions + '</article>';
    }).join('');
  }

  function openUserModal(id) {
    if (!isAdmin()) return;
    var user = id ? state.users.find(function (entry) { return entry.id === id; }) : null;
    if (user && user.role === 'admin') return;
    state.editingUserId = user ? user.id : null;
    $('#userModalKicker').textContent = user ? 'EDIT HR ACCOUNT' : 'NEW HR ACCOUNT';
    $('#userModalTitle').textContent = user ? 'Edit HR account' : 'Add HR account';
    $('#userForm [name="name"]').value = user ? user.name : '';
    $('#userForm [name="username"]').value = user ? user.username : '';
    $('#userForm [name="password"]').value = '';
    $('#userForm [name="password"]').type = 'password';
    $('#userPasswordToggle').innerHTML = '<i class="ti ti-eye"></i>';
    $('#userForm [name="password"]').required = !user;
    $('#userForm [name="active"]').checked = user ? user.active : true;
    $('#passwordRequirement').textContent = user ? 'Optional' : 'At least 10 characters';
    $('#passwordEditHint').textContent = user ? 'Leave blank to keep the current password.' : 'Required for new accounts.';
    $('#userModalBackdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#userForm [name="name"]').focus(); }, 120);
  }

  function closeUserModal() {
    $('#userModalBackdrop').classList.remove('is-open');
    state.editingUserId = null;
    $('#userForm').reset();
    document.body.style.overflow = '';
  }

  async function saveUser(event) {
    event.preventDefault();
    var button = $('#userForm button[type="submit"]');
    var payload = {
      name: $('#userForm [name="name"]').value.trim(),
      username: $('#userForm [name="username"]').value.trim(),
      password: $('#userForm [name="password"]').value,
      active: $('#userForm [name="active"]').checked,
    };
    var editing = Boolean(state.editingUserId);
    try {
      setBusy(button, true);
      var url = '/api/admin/users' + (state.editingUserId ? '/' + encodeURIComponent(state.editingUserId) : '');
      var result = await api(url, { method: state.editingUserId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      state.users = result.users || state.users;
      closeUserModal();
      renderUsers();
      toast(editing ? 'The HR account was updated.' : 'The HR account was created with Careers-only access.');
    } catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }

  function askUserDelete(id) {
    var user = state.users.find(function (entry) { return entry.id === id; });
    if (!user || user.role === 'admin') return;
    state.pendingDelete = { kind: 'user', id: id };
    $('#confirmTitle').textContent = 'Delete this HR account?';
    $('#confirmText').textContent = '“' + user.name + '” will lose access immediately and all active sessions will be revoked.';
    $('#modalBackdrop').classList.add('is-open');
  }

  function openMobileMenu() { $('#sidebar').classList.add('is-open'); $('#mobileOverlay').classList.add('is-open'); }
  function closeMobileMenu() { $('#sidebar').classList.remove('is-open'); $('#mobileOverlay').classList.remove('is-open'); }

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
        await loadContent();
        await loadApplications();
        await loadContactRequests();
        await loadUsers();
        showApp(); toast('Welcome back. Your content is ready.');
      } catch (error) { $('#loginError').textContent = error.message; }
      finally { setBusy(button, false); }
    });

    $('#passwordToggle').addEventListener('click', function () {
      var input = $('#loginPassword'); var hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password';
      this.innerHTML = '<i class="ti ' + (hidden ? 'ti-eye-off' : 'ti-eye') + '"></i>';
    });

    $('#logoutBtn').addEventListener('click', async function () {
      try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch (_) {}
      state.csrf = ''; state.data = null; state.users = []; state.applications = []; state.contactRequests = []; state.currentUser = null; state.permissions = null; $('#loginPassword').value = ''; showLogin();
    });

    $$('.side-link').forEach(function (button) {
      button.addEventListener('click', function () { switchView(button.dataset.view || 'content', button.dataset.collection); });
    });
    $$('[data-view-link]').forEach(function (button) { button.addEventListener('click', function () { switchView(button.dataset.viewLink); }); });
    $$('[data-quick-collection]').forEach(function (button) { button.addEventListener('click', function () { switchView('content', button.dataset.quickCollection); openEditor(); }); });
    $$('[data-quick-add]').forEach(function (button) { button.addEventListener('click', function () { switchView('content', isAdmin() ? 'blogs' : 'jobs'); openEditor(); }); });

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
    $('#vacancyScrollPrev').addEventListener('click', function () { scrollVacancies(-1); });
    $('#vacancyScrollNext').addEventListener('click', function () { scrollVacancies(1); });
    $('#applicationVacancyCards').addEventListener('scroll', updateVacancyScrollControls, { passive: true });
    window.addEventListener('resize', updateVacancyScrollControls);
    $('#applicationsList').addEventListener('change', function (event) { if (event.target.matches('[data-application-status]')) updateApplicationStatus(event.target); });
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
      if (button.dataset.action === 'up') moveItem(id, -1);
      if (button.dataset.action === 'down') moveItem(id, 1);
    });

    $('#itemForm').addEventListener('submit', saveItem);
    $('#closeDrawerBtn').addEventListener('click', closeEditor);
    $('#cancelDrawerBtn').addEventListener('click', closeEditor);
    $('#drawerBackdrop').addEventListener('click', closeEditor);
    $('#drawerDeleteBtn').addEventListener('click', function () { if (state.editingId) askDelete(state.editingId); });
    $('#dynamicFields').addEventListener('change', function (event) { if (event.target.matches('[data-image-upload]')) uploadImage(event.target.files[0]); });
    $('#dynamicFields').addEventListener('click', function (event) {
      var removeImage = event.target.closest('[data-remove-image]');
      if (removeImage) {
        event.preventDefault();
        var input = $('.image-path', $('#dynamicFields')); if (input) input.value = '';
        var preview = $('.image-preview', $('#dynamicFields')); if (preview) preview.remove();
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
      if (!event.target.matches('[data-wordcount]')) return;
      var label = event.target.parentElement && event.target.parentElement.querySelector('.word-count');
      if (!label) return;
      var min = Number(event.target.dataset.minWords || 40);
      var max = Number(event.target.dataset.maxWords || 60);
      var count = wordCount(event.target.value);
      label.textContent = count + ' words (target ' + min + '–' + max + ')';
      label.style.color = (count < min || count > max) ? '#e56883' : '';
    });

    $('#cancelConfirmBtn').addEventListener('click', closeConfirm);
    $('#confirmDeleteBtn').addEventListener('click', confirmDelete);
    $('#modalBackdrop').addEventListener('click', function (event) { if (event.target === this) closeConfirm(); });

    $('#pageSelector').addEventListener('click', function (event) { var button = event.target.closest('[data-page]'); if (!button) return; state.currentPage = button.dataset.page; renderPageSelector(); renderPageForm(); });
    $('#pageForm').addEventListener('submit', savePage);
    $('#pageForm [name="lead"]').addEventListener('input', updateCharCount);
    $('#previewPageBtn').addEventListener('click', function () { window.open(pageInfo[state.currentPage].url, '_blank', 'noopener'); });
    $('#exportBtn').addEventListener('click', exportContent);
    $('#importInput').addEventListener('change', function () { importContent(this.files[0]); });

    $('#addUserBtn').addEventListener('click', function () { openUserModal(); });
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
    $('#userPasswordToggle').addEventListener('click', function () {
      var input = $('#userForm [name="password"]'); var hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password';
      this.innerHTML = '<i class="ti ' + (hidden ? 'ti-eye-off' : 'ti-eye') + '"></i>';
    });

    $('#globalSearch').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !this.value.trim()) return;
      var query = this.value.trim().toLowerCase();
      var match = Object.keys(collectionInfo).find(function (key) { return (state.data.collections[key] || []).some(function (item) { return JSON.stringify(item).toLowerCase().indexOf(query) > -1; }); });
      if (!match) return toast('No content matched this search.', true);
      switchView('content', match); state.query = this.value.trim(); $('#collectionSearch').value = state.query; renderCollection();
    });
    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); }
      if (event.key === 'Escape') { if ($('#userModalBackdrop').classList.contains('is-open')) closeUserModal(); else if ($('#modalBackdrop').classList.contains('is-open')) closeConfirm(); else if ($('#editorDrawer').classList.contains('is-open')) closeEditor(); else closeMobileMenu(); }
    });
    $('#menuToggle').addEventListener('click', openMobileMenu);
    $('#mobileOverlay').addEventListener('click', closeMobileMenu);
  }

  bindEvents();
  bootstrap();
})();
