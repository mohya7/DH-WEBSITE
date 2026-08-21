(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function pageDepth() {
    var clean = window.location.pathname.replace(/\\/g, '/').replace(/^\//, '');
    var segments = clean.split('/').filter(Boolean);
    if (!segments.length) return '';
    var last = segments[segments.length - 1];
    var looksLikeFile = /\.[a-z0-9]+$/i.test(last);
    var depth = looksLikeFile ? segments.length - 1 : segments.length;
    return '../'.repeat(depth);
  }

  var prefix = pageDepth();

  function rel(value) {
    value = String(value || '');
    if (!value || /^(?:[a-z]+:|#|\/\/)/i.test(value)) return value;
    return prefix + value.replace(/^\//, '');
  }

  function sorted(data, collection) {
    return ((data.collections && data.collections[collection]) || [])
      .filter(function (item) { return item.status !== 'draft'; })
      .slice()
      .sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  }

  var detailDirectories = { services: 'services', partners: 'partners', caseStudies: 'cases', blogs: 'blogs', jobs: 'careers' };

  function contentSlug(value) {
    var slug = String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return slug || 'item';
  }

  function itemHref(item, collection) {
    if (item.href) return item.href;
    var directory = detailDirectories[collection];
    if (!directory) return '';
    return directory + '/' + contentSlug(item.title || item.name || item.id) + '.html';
  }

  function setText(selector, value) {
    var node = document.querySelector(selector);
    if (node && value) node.textContent = value;
  }

  function renderHomeNumbers(numbers) {
    var section = document.querySelector('#numbers');
    if (!section || !numbers || typeof numbers !== 'object') return;
    var head = section.querySelector('.numbers-head');
    if (head) {
      var label = head.querySelector('.label');
      var title = head.querySelector('.h2');
      var lead = head.querySelector('.lead');
      if (label && numbers.label) label.textContent = numbers.label;
      if (title && numbers.title) title.textContent = numbers.title;
      if (lead && numbers.lead) lead.textContent = numbers.lead;
    }
    var row = section.querySelector('.numbers-row');
    var stats = Array.isArray(numbers.stats) ? numbers.stats.filter(function (entry) {
      return entry && (entry.label || entry.value);
    }) : [];
    if (!row || !stats.length) return;
    row.innerHTML = stats.map(function (stat) {
      var value = String(stat.value == null ? '' : stat.value).replace(/[^\d]/g, '') || '0';
      var suffix = String(stat.suffix || '').slice(0, 4);
      return '<div class="stat" data-reveal>' +
        '<div class="stat-num" data-count="' + esc(value) + '"' + (suffix ? ' data-suffix="' + esc(suffix) + '"' : '') + '>0</div>' +
        '<p class="stat-label">' + esc(stat.label || '') + '</p>' +
        '</div>';
    }).join('');
  }

  function setHighlightedTitle(selector, value) {
    var node = document.querySelector(selector);
    if (!node || !value) return;
    var words = String(value).trim().split(/\s+/);
    var count = Math.min(3, Math.max(1, Math.round(words.length * 0.34)));
    var regular = words.slice(0, -count).join(' ');
    var accent = words.slice(-count).join(' ');
    node.innerHTML = (regular ? esc(regular) + ' ' : '') + '<em>' + esc(accent) + '</em>';
  }

  function currentPage() {
    var path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    var last = path.split('/').filter(Boolean).pop() || 'index.html';
    var isIndex = last === 'index.html' || !/\.[a-z0-9]+$/.test(last);
    if (path.indexOf('about-us') > -1) return 'about';
    if (!isIndex) return null;
    if (path.indexOf('/blogs') > -1) return 'blogs';
    if (path.indexOf('/news') > -1) return 'news';
    if (path.indexOf('/cases') > -1) return 'cases';
    if (path.indexOf('/partners') > -1) return 'partners';
    if (path.indexOf('/careers') > -1) return 'careers';
    return 'home';
  }

  function renderPageCopy(data) {
    var page = currentPage();
    if (!page || !data.pages || !data.pages[page]) return;
    var copy = data.pages[page];
    if (page === 'home') {
      setText('.hero .eyebrow span:last-child', copy.label);
      var title = document.querySelector('.h1-wrap');
      if (title && copy.title) {
        var lines = String(copy.title).split(/\n+/).filter(Boolean);
        title.innerHTML = lines.map(function (line) {
          return '<span class="h1-line"><span>' + esc(line) + '</span></span>';
        }).join('');
        title.setAttribute('aria-label', lines.join(' '));
      }
      setText('.hero-sub', copy.lead);
      setText('.services-title', copy.sectionTitle);
      if (copy.seoTitle) document.title = copy.seoTitle;
      renderHomeNumbers(copy.numbers);
      return;
    }

    if (page === 'about') {
      setText('.about-banner .label', copy.label);
      setText('.about-banner h1', copy.title);
      setText('.about-banner .lead', copy.lead);
      setText('.about-leaders .about-head h2', copy.sectionTitle);
      setText('.about-leaders .about-head p', copy.sectionLead);
      return;
    }

    setText('.hub-banner .label', copy.label);
    setHighlightedTitle('.hub-banner h1', copy.title);
    setText('.hub-banner .lead', copy.lead);
    if (page === 'careers') {
      setText('.careers-opps__head h2', copy.sectionTitle);
      setText('.careers-opps__head p', copy.sectionLead);
    } else {
      setText('.hub-head h2', copy.sectionTitle);
      setText('.hub-head p', copy.sectionLead);
    }
    if (copy.seoTitle) document.title = copy.seoTitle;
    else if (copy.title) document.title = String(copy.title).replace(/\s+/g, ' ').trim() + ' | Digital Hub S.A.E';
  }

  function serviceVisual(type) {
    if (type === 'data') return '<div class="svc-viz-data"><div class="svc-data-bars"><span class="svc-data-bar"></span><span class="svc-data-bar"></span><span class="svc-data-bar"></span><span class="svc-data-bar"></span><span class="svc-data-bar"></span></div><span class="svc-data-node"></span><span class="svc-data-node"></span><span class="svc-data-node"></span><span class="svc-data-line"></span><span class="svc-data-line"></span></div>';
    if (type === 'ai') return '<div class="svc-viz-ai"><div class="svc-ai-orb"></div><span class="svc-ai-node"></span><span class="svc-ai-node"></span><span class="svc-ai-node"></span><span class="svc-ai-node"></span><span class="svc-ai-node"></span></div>';
    if (type === 'team') return '<div class="svc-viz-team"><div class="svc-team-pill"><span class="svc-team-av"><i class="ti ti-code"></i></span>Developer</div><div class="svc-team-pill"><span class="svc-team-av"><i class="ti ti-database"></i></span>Data Engineer</div><div class="svc-team-pill"><span class="svc-team-av"><i class="ti ti-brain"></i></span>AI Specialist</div><div class="svc-team-pill"><span class="svc-team-av"><i class="ti ti-test-pipe"></i></span>QA Engineer</div></div>';
    return '<div class="svc-viz-code"><div class="svc-code-win"><div class="svc-code-bar"><span class="svc-code-dot"></span><span class="svc-code-dot"></span><span class="svc-code-dot"></span></div><div class="svc-code-lines"><span class="svc-code-line"></span><span class="svc-code-line"></span><span class="svc-code-line"></span></div></div><div class="svc-code-win"><div class="svc-code-bar"><span class="svc-code-dot"></span><span class="svc-code-dot"></span><span class="svc-code-dot"></span></div><div class="svc-code-lines"><span class="svc-code-line"></span><span class="svc-code-line"></span></div></div></div>';
  }

  function renderHomeServices(data) {
    var track = document.getElementById('servicesTrack');
    if (!track) return;
    track.innerHTML = sorted(data, 'services').map(function (item) {
      return '<article class="svc-card" data-reveal>' +
        '<div class="svc-card__body"><div class="svc-card__icon"><i class="ti ' + esc(item.icon || 'ti-sparkles') + '"></i></div>' +
        '<h3 class="svc-card__title">' + esc(item.title) + '</h3><p class="svc-card__desc">' + esc(item.summary) + '</p>' +
        '<a class="svc-card__link" href="' + esc(rel(itemHref(item, 'services'))) + '">Learn more <i class="ti ti-arrow-right"></i></a></div>' +
        '<div class="svc-card__visual" aria-hidden="true">' + serviceVisual(item.visual) + '</div></article>';
    }).join('') + '<div class="services-track-end" aria-hidden="true"></div>';
  }

  function caseCard(item) {
    return '<article class="case" data-category="' + esc((item.categories || []).join(' ')) + '" data-stagger-item data-reveal>' +
      '<div class="case-glass" aria-hidden="true"></div><a class="case-link" href="' + esc(rel(itemHref(item, 'caseStudies'))) + '" aria-label="Read case study: ' + esc(item.title) + '">' +
      '<div class="case-media"><img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || item.title) + '" width="800" height="500" loading="lazy" decoding="async"></div>' +
      '<div class="case-body"><h3 class="case-title">' + esc(item.title) + '</h3><p class="case-excerpt">' + esc(item.summary) + '</p><span class="case-btn">Read More</span></div></a></article>';
  }

  function renderCases(data) {
    var grid = document.querySelector('.cases-grid');
    if (!grid) return;
    var items = sorted(data, 'caseStudies');
    if (currentPage() === 'home') items = items.slice(0, 4);
    grid.innerHTML = items.map(caseCard).join('');
  }

  function partnerSlug(item) {
    var href = String(item.href || itemHref(item, 'partners') || '');
    var match = href.match(/(?:^|\/)([a-z0-9-]+)\.html$/i);
    if (match) return match[1].toLowerCase();
    var id = String(item.id || '');
    if (id.indexOf('partner-') === 0) return id.slice(8).toLowerCase();
    return contentSlug(item.name);
  }

  function findPartnerByHref(items, href) {
    href = String(href || '').replace(/\\/g, '/').toLowerCase();
    return items.find(function (item) {
      var slug = partnerSlug(item);
      var target = String(itemHref(item, 'partners') || '').toLowerCase();
      return href.indexOf('/' + slug + '.html') > -1
        || href.endsWith(slug + '.html')
        || (target && href.endsWith(target));
    }) || null;
  }

  function applyPartnerLogo(img, item) {
    if (!img || !item || !item.image) return;
    img.setAttribute('src', rel(item.image));
    img.setAttribute('alt', item.alt || (item.name + ' logo'));
  }

  function renderPartners(data) {
    var items = sorted(data, 'partners');
    var hubs = document.querySelectorAll('.partners-hub-grid');
    if (hubs.length && currentPage() === 'partners') {
      hubs.forEach(function (hub) {
        hub.innerHTML = items.map(function (item) {
          return '<a class="partner-card-hub" href="' + esc(rel(itemHref(item, 'partners'))) + '" data-reveal aria-label="Explore ' + esc(item.name) + ' partnership">' +
            '<div class="partner-card-hub__logo"><img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || (item.name + ' logo')) + '" loading="lazy" decoding="async"></div>' +
            '<h3 class="partner-card-hub__title">' + esc(item.name) + '</h3><p class="partner-card-hub__desc">' + esc(item.summary) + '</p>' +
            '<span class="partner-card-hub__link">Explore partnership <i class="ti ti-arrow-right"></i></span></a>';
        }).join('');
      });
    } else {
      hubs.forEach(function (hub) {
        hub.querySelectorAll('a.partner-card-hub').forEach(function (card) {
          var item = findPartnerByHref(items, card.getAttribute('href'));
          if (item) applyPartnerLogo(card.querySelector('img'), item);
        });
      });
    }

    var home = document.querySelector('#partners .partners-grid');
    if (home) {
      home.innerHTML = items.slice(0, 6).map(function (item) {
        return '<article class="partner" data-reveal tabindex="0"><div class="partner-card"><div class="partner-card__bg" aria-hidden="true"></div><div class="partner-card__dim" aria-hidden="true"></div><div class="partner-card__blur" aria-hidden="true"></div>' +
          '<div class="partner-logo-wrap"><img class="partner-logo-img" src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || (item.name + ' logo')) + '" loading="lazy" decoding="async"></div>' +
          '<div class="partner-reveal"><p>' + esc(item.summary) + '</p><a class="partner-btn" href="' + esc(rel(itemHref(item, 'partners'))) + '">Explore More</a></div></div></article>';
      }).join('');
    }

    document.querySelectorAll('.partner-logos .plogo').forEach(function (link) {
      var item = findPartnerByHref(items, link.getAttribute('href'));
      if (item) applyPartnerLogo(link.querySelector('img'), item);
    });

    var path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    items.forEach(function (item) {
      var slug = partnerSlug(item);
      if (path.indexOf('/' + slug + '.html') === -1 && !path.endsWith('/' + slug)) return;
      applyPartnerLogo(document.querySelector('.partner-view-logo img'), item);
    });
  }

  function blogHubCard(item) {
    var accent = item.accent === 'orange' ? ' blog-card__tag--orange' : '';
    return '<a class="blog-card" href="' + esc(rel(itemHref(item, 'blogs'))) + '" data-category="' + esc(item.category) + '" data-reveal aria-label="Read: ' + esc(item.title) + '">' +
      '<img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || item.title) + '" width="810" height="500" loading="lazy" decoding="async"><div class="blog-card__shade" aria-hidden="true"></div>' +
      '<div class="blog-card__body"><span class="blog-card__tag' + accent + '">' + esc(item.categoryLabel || item.category) + '</span><h3 class="blog-card__title">' + esc(item.title) + '</h3>' +
      '<div class="blog-card__row"><span class="blog-card__meta"><strong>' + esc(item.readTime) + ' min</strong> read</span><span class="blog-card__arrow" aria-hidden="true"><i class="ti ti-arrow-up-right"></i></span></div></div></a>';
  }

  function renderBlogs(data) {
    var items = sorted(data, 'blogs');
    var hub = document.querySelector('.blogs-hub-grid');
    if (hub) hub.innerHTML = items.map(blogHubCard).join('');
    var track = document.getElementById('blogsTrack');
    if (track) {
      track.innerHTML = items.slice(0, 5).map(function (item) {
        return '<a class="blog-dest" href="' + esc(rel(itemHref(item, 'blogs'))) + '" aria-label="Read: ' + esc(item.title) + '"><img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || item.title) + '" width="810" height="500" loading="lazy" decoding="async"><div class="blog-dest__shade" aria-hidden="true"></div>' +
          '<div class="blog-dest__body"><h3 class="blog-dest__title">' + esc(item.title) + '</h3><div class="blog-dest__row"><span class="blog-dest__meta"><strong>' + esc(item.readTime) + ' min</strong> read</span><span class="blog-dest__arrow" aria-hidden="true"><i class="ti ti-arrow-up-right"></i></span></div></div></a>';
      }).join('');
    }
  }

  function newsMediaClass(category) {
    var value = String(category || '').toLowerCase();
    if (value.indexOf('event') > -1) return 'events';
    if (value.indexOf('project') > -1) return 'projects';
    return 'partnership';
  }

  function newsCardInner(item, options) {
    var media = newsMediaClass(item.category);
    var withToggle = options && options.withToggle;
    var panelId = options && options.panelId;
    var toggle = withToggle
      ? '<button type="button" class="news-slide__details" aria-expanded="false"' + (panelId ? ' aria-controls="' + esc(panelId) + '"' : '') + '>Full details <i class="ti ti-arrow-down" aria-hidden="true"></i></button>'
      : '';
    return '<div class="news-slide__media news-slide__media--' + esc(media) + '"><img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || item.title) + '" loading="lazy" decoding="async" width="1400" height="933"></div>' +
      '<div class="news-slide__shade" aria-hidden="true"></div><div class="news-slide__dim" aria-hidden="true"></div>' +
      '<div class="news-slide__body"><div class="news-slide__top"><span class="news-slide__chip">' + esc(item.category || 'News') + '</span></div>' +
      '<div class="news-slide__bottom"><div class="news-slide__blur" aria-hidden="true"></div><div class="news-slide__foot"><div class="news-slide__info">' +
      (item.location ? '<div class="news-slide__meta"><i class="ti ti-map-pin"></i> ' + esc(item.location) + '</div>' : '') +
      '<h3 class="news-slide__title">' + esc(item.title) + '</h3><p class="news-slide__sub">' + esc(item.summary) + '</p></div>' +
      '<div class="news-slide__stat"><span class="news-slide__stat-val">' + esc(item.year || '') + '</span><span class="news-slide__stat-label">' + esc(item.month || '') + '</span>' + toggle + '</div>' +
      '</div></div></div>';
  }

  function newsHubCard(item) {
    var panelId = 'news-panel-' + contentSlug(item.id || item.title);
    var details = String(item.details || item.summary || '').trim();
    return '<article class="news-slide is-active news-hub-item">' +
      '<div class="news-slide__surface">' + newsCardInner(item, { withToggle: true, panelId: panelId }) + '</div>' +
      '<div class="news-slide__panel" id="' + esc(panelId) + '" hidden><p>' + esc(details) + '</p></div>' +
      '</article>';
  }

  function renderNews(data) {
    var items = sorted(data, 'news');
    var hub = document.querySelector('.news-hub-grid');
    if (hub && items.length) hub.innerHTML = items.map(newsHubCard).join('');
    var track = document.getElementById('newsTrack');
    if (track && items.length) {
      track.innerHTML = items.slice(0, 8).map(function (item, index) {
        var active = index === Math.min(1, items.length - 1) ? ' is-active' : '';
        return '<article class="news-slide' + active + '"><div class="news-slide__link" role="group" aria-label="' + esc(item.title) + '">' +
          newsCardInner(item) + '</div></article>';
      }).join('');
    }
  }

  function renderJobs(data) {
    var list = document.querySelector('.careers-opps__list');
    if (!list || currentPage() !== 'careers') return;
    list.innerHTML = sorted(data, 'jobs').map(function (item) {
      return '<article class="careers-job-card"><div><h3>' + esc(item.title) + '</h3><p class="cms-job-meta">' + esc([item.department, item.type, item.location].filter(Boolean).join(' · ')) + '</p></div>' +
        '<a class="btn-pill" href="' + esc(rel(itemHref(item, 'jobs'))) + '">More Info <i class="ti ti-arrow-up-right" aria-hidden="true"></i></a></article>';
    }).join('');
  }

  function renderTeam(data) {
    var inner = document.getElementById('teamStripInner');
    if (!inner) return;
    inner.innerHTML = sorted(data, 'team').map(function (item) {
      var profile = String(item.linkedin || '').trim();
      var href = /^https?:\/\//i.test(profile) ? profile : '#';
      var external = href !== '#' ? ' target="_blank" rel="noopener"' : '';
      return '<div class="team-strip__item"><div class="team-card"><div class="team-card__photo"><img src="' + esc(rel(item.image)) + '" alt="' + esc(item.alt || (item.role ? (item.name + ', ' + item.role) : item.name)) + '" width="320" height="390" loading="lazy" decoding="async">' +
        '<div class="team-card__overlay"><div class="team-card__meta"><p class="team-card__role">' + esc(item.role) + '</p><h3 class="team-card__name">' + esc(item.name) + '</h3></div>' +
        '<div class="team-card__actions"><a class="team-card__action team-card__action--linkedin" href="' + esc(href) + '"' + external + ' aria-label="' + esc(item.name) + ' on LinkedIn"><i class="ti ti-brand-linkedin" aria-hidden="true"></i></a></div></div></div></div></div>';
    }).join('');
  }

  function renderFooterSocial(data) {
    var box = document.querySelector('.footer-social');
    if (!box) return;
    var social = (data.pages && data.pages.home && data.pages.home.social) || {};
    var items = [
      { key: 'linkedin', label: 'LinkedIn', icon: 'ti-brand-linkedin' },
      { key: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook' },
      { key: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram' },
      { key: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok' }
    ];
    box.innerHTML = items.filter(function (item) {
      return /^https?:\/\//i.test(String(social[item.key] || '').trim());
    }).map(function (item) {
      return '<a href="' + esc(String(social[item.key]).trim()) + '" target="_blank" rel="noopener" aria-label="' + esc(item.label) + '"><i class="ti ' + item.icon + '"></i></a>';
    }).join('');
  }

  function render(data) {
    if (!data || !data.collections) return;
    renderPageCopy(data);
    renderHomeServices(data);
    renderPartners(data);
    renderCases(data);
    renderBlogs(data);
    renderNews(data);
    renderJobs(data);
    renderTeam(data);
    renderFooterSocial(data);
    document.documentElement.setAttribute('data-content-revision', data.meta && data.meta.revision || '0');
    window.dispatchEvent(new CustomEvent('dh:content-ready', { detail: data.meta || {} }));
  }

  if (window.DH_CONTENT) {
    render(window.DH_CONTENT);
  } else {
    fetch(prefix + 'content/site-content.json', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(render)
      .catch(function () { /* Keep the server-rendered HTML as a safe fallback. */ });
  }
})();
