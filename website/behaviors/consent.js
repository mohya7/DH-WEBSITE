/*
 * Consent Mode v2 ("basic") and the cookie banner. Plain script, same shape as contact.js.
 *
 * Nothing non-essential loads before consent. Tag Manager (gtm.js) is requested
 * only once analytics or marketing is granted, now or by a saved choice. Before
 * that no Google request is made and no event is pushed. The data layer holds
 * only the Consent Mode defaults, all four denied, which Tag Manager reads
 * first when it does load. The order at that moment is: defaults, the consent
 * update, then the gtm.js start event, then the script request.
 *
 * Revoking later pushes the update to denied and stops every event push. The
 * Tag Manager script already on the page stays until the next page load; it
 * is not requested again on later pages while nothing is granted.
 *
 * The saved choice is one of the three values the buttons write:
 * v=1&a=0&m=0 (reject), v=1&a=1&m=0 (analytics only), v=1&a=1&m=1 (accept all).
 * Anything else is no choice, and the banner asks again. That includes no
 * version, another version, a duplicate or unknown key, a value that does not
 * decode, and marketing without analytics (v=1&a=0&m=1).
 *
 * The banner is a non-modal bottom banner. It does not take focus when it
 * opens by itself, does not trap Tab, and Escape deliberately does nothing:
 * the page behind stays usable, and only a choice closes it. While it is open
 * its height is reserved at the bottom of the page, so it never covers the
 * footer. Cookie settings reopens it with the saved choice pressed and focused;
 * after a choice, focus returns to the control that opened it.
 *
 * Events carry only an event name: no name, email, phone, or form content.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var container = (script.getAttribute('data-container') || '').trim();
  if (!/^GTM-[A-Z0-9]{7,}$/.test(container)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  var cookieName = 'dh_consent';
  var year = 60 * 60 * 24 * 365;
  var root = document.documentElement;

  function read() {
    var found = ('; ' + document.cookie).split('; ' + cookieName + '=');
    if (found.length !== 2) return null;
    var value;
    try {
      value = decodeURIComponent(found[1].split(';')[0]);
    } catch (_) {
      return null;
    }
    if (value !== 'v=1&a=0&m=0' && value !== 'v=1&a=1&m=0' && value !== 'v=1&a=1&m=1') return null;
    return { analytics: value !== 'v=1&a=0&m=0', marketing: value === 'v=1&a=1&m=1' };
  }
  function write(choice) {
    var value = 'v=1&a=' + (choice.analytics ? '1' : '0') + '&m=' + (choice.marketing ? '1' : '0');
    document.cookie = cookieName + '=' + value + '; Max-Age=' + year + '; Path=/; Secure; SameSite=Lax';
  }
  function granted(choice) { return !!choice && (choice.analytics || choice.marketing); }

  var loaded = false;
  var current = null;
  function update(choice) {
    gtag('consent', 'update', {
      analytics_storage: choice.analytics ? 'granted' : 'denied',
      ad_storage: choice.marketing ? 'granted' : 'denied',
      ad_user_data: choice.marketing ? 'granted' : 'denied',
      ad_personalization: choice.marketing ? 'granted' : 'denied'
    });
  }
  /** The update (only when Tag Manager is, or is about to be, on the page), then Tag Manager itself. */
  function apply(choice) {
    current = choice;
    if (granted(choice) || loaded) update(choice);
    if (granted(choice)) root.setAttribute('data-analytics', '');
    else root.removeAttribute('data-analytics');
    if (!granted(choice) || loaded) return;
    loaded = true;
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var loader = document.createElement('script');
    loader.async = true;
    loader.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(container);
    document.head.appendChild(loader);
  }

  var stored = read();
  if (stored) apply(stored);

  var banner = document.getElementById('cookieBanner');
  var opener = null;
  function buttons() { return banner ? Array.prototype.slice.call(banner.querySelectorAll('button[data-consent]')) : []; }
  /** The three button values only. Marketing without analytics is not one of them. */
  function kindOf(choice) {
    if (!choice) return null;
    if (choice.analytics && choice.marketing) return 'accept';
    if (choice.analytics) return 'analytics';
    if (!choice.marketing) return 'reject';
    return null;
  }
  function reserve() {
    if (!banner || banner.hidden) return;
    root.style.setProperty('--cookie-banner-space', banner.offsetHeight + 'px');
  }
  function show(from) {
    if (!banner) return;
    opener = from || null;
    var saved = kindOf(read());
    buttons().forEach(function (button) {
      if (saved) button.setAttribute('aria-pressed', button.getAttribute('data-consent') === saved ? 'true' : 'false');
      else button.removeAttribute('aria-pressed');
    });
    banner.hidden = false;
    root.setAttribute('data-cookie-banner-open', '');
    reserve();
    if (!opener) return;
    var target = banner.querySelector('button[aria-pressed="true"]') || buttons()[0];
    if (target) target.focus();
  }
  function hide() {
    if (!banner) return;
    banner.hidden = true;
    root.removeAttribute('data-cookie-banner-open');
    root.style.removeProperty('--cookie-banner-space');
    if (opener && opener.focus) opener.focus();
    opener = null;
  }
  if (banner) {
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-consent]');
      if (!button) return;
      var kind = button.getAttribute('data-consent');
      var choice = kind === 'accept' ? { analytics: true, marketing: true }
        : kind === 'analytics' ? { analytics: true, marketing: false }
        : { analytics: false, marketing: false };
      write(choice);
      apply(choice);
      hide();
    });
    window.addEventListener('resize', reserve);
    if (typeof ResizeObserver === 'function') new ResizeObserver(reserve).observe(banner);
    if (!stored) show(null);
  }
  document.addEventListener('click', function (event) {
    var settings = event.target.closest('[data-cookie-settings]');
    if (settings) {
      event.preventDefault();
      show(settings);
      return;
    }
    if (!granted(current)) return;
    var cta = event.target.closest('a.nav-cta, a.mn-cta, .hub-cta a, .svc-cta-row a, .cs-cta a, .about-hero__cta a');
    if (!cta) return;
    window.dataLayer.push({ event: 'cta_clicked' });
  });
})();
