/*
 * Consent Mode v2 and the cookie banner. Plain script, same shape as contact.js.
 *
 * Events are pushed to dataLayer even when storage is denied. Consent Mode v2
 * then lets Tag Manager send a cookieless ping, and the event object carries
 * only an event name: no name, email, phone, or form content. Nothing here
 * runs when the container id is missing or not a GTM id.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var container = (script.getAttribute('data-container') || '').trim();
  if (!/^GTM-[A-Z0-9]{7,}$/.test(container)) return;

  document.documentElement.setAttribute('data-analytics', '');
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  var cookieName = 'dh_consent';
  var year = 60 * 60 * 24 * 365;
  function read() {
    var parts = ('; ' + document.cookie).split('; ' + cookieName + '=');
    if (parts.length < 2) return null;
    var value = decodeURIComponent(parts.pop().split(';').shift() || '');
    var analytics = /(?:^|&)a=1(?:&|$)/.test(value);
    var marketing = /(?:^|&)m=1(?:&|$)/.test(value);
    if (!/(?:^|&)a=[01](?:&|$)/.test(value) || !/(?:^|&)m=[01](?:&|$)/.test(value)) return null;
    return { analytics: analytics, marketing: marketing };
  }
  function write(choice) {
    var value = 'a=' + (choice.analytics ? '1' : '0') + '&m=' + (choice.marketing ? '1' : '0');
    document.cookie = cookieName + '=' + value + '; Max-Age=' + year + '; Path=/; Secure; SameSite=Lax';
  }
  function apply(choice) {
    gtag('consent', 'update', {
      analytics_storage: choice.analytics ? 'granted' : 'denied',
      ad_storage: choice.marketing ? 'granted' : 'denied',
      ad_user_data: choice.marketing ? 'granted' : 'denied',
      ad_personalization: choice.marketing ? 'granted' : 'denied'
    });
  }

  var stored = read();
  if (stored) apply(stored);

  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(container);
  document.head.appendChild(loader);

  var banner = document.getElementById('cookieBanner');
  var opener = null;
  function buttons() { return banner ? Array.prototype.slice.call(banner.querySelectorAll('button')) : []; }
  function hide() {
    if (!banner) return;
    banner.hidden = true;
    banner.removeEventListener('keydown', trap);
    if (opener && opener.focus) opener.focus();
    opener = null;
  }
  function show(from) {
    if (!banner) return;
    opener = from || null;
    banner.hidden = false;
    banner.addEventListener('keydown', trap);
    var first = buttons()[0];
    if (first) first.focus();
  }
  function trap(event) {
    if (event.key !== 'Tab') return;
    var list = buttons();
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function choose(choice) {
    write(choice);
    apply(choice);
    hide();
  }
  if (banner) {
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-consent]');
      if (!button) return;
      var kind = button.getAttribute('data-consent');
      if (kind === 'accept') choose({ analytics: true, marketing: true });
      else if (kind === 'analytics') choose({ analytics: true, marketing: false });
      else choose({ analytics: false, marketing: false });
    });
    if (!stored) show(null);
  }
  document.addEventListener('click', function (event) {
    var settings = event.target.closest('[data-cookie-settings]');
    if (settings) {
      event.preventDefault();
      show(settings);
      return;
    }
    var cta = event.target.closest('a.nav-cta, a.mn-cta, .hub-cta a');
    if (!cta) return;
    window.dataLayer.push({ event: 'cta_clicked' });
  });
})();
