
(function(){
  gsap.registerPlugin(ScrollTrigger);

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;

  if (!reduceMotion && typeof Lenis !== 'undefined'){
    lenis = new Lenis({
      lerp: 0.12,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1
    });
    window.__lenis = lenis;

    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop: function(value){
        if (arguments.length){
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
      getBoundingClientRect: function(){
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      }
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var servicesScroll = document.getElementById('servicesScroll');
  var servicesTrack = document.getElementById('servicesTrack');
  var servicesPin = document.getElementById('servicesPin');
  if (!servicesScroll || !servicesTrack || !servicesPin) return;

  var servicesViewport = servicesPin.querySelector('.services-viewport');
  var servicesMM = gsap.matchMedia();
  var servicesTween = null;

  gsap.set(servicesTrack, { force3D: true });

  function servicesPadX(){
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad-x')) || 64;
  }

  function servicesGetDist(){
    if (!servicesViewport) return 0;
    var cards = servicesTrack.querySelectorAll('.svc-card');
    if (!cards.length) return 0;
    void servicesTrack.offsetHeight;
    var last = cards[cards.length - 1];
    var pad = servicesPadX();
    return Math.max(0, Math.ceil(last.offsetLeft + last.offsetWidth + pad - servicesViewport.clientWidth));
  }

  function servicesIsMobile(){
    return window.matchMedia('(max-width: 991px)').matches;
  }

  function syncServicesNavOffset(){
    var nav = document.getElementById('nav');
    var section = servicesScroll.closest('.section.services') || servicesScroll;
    var fallback = 160;
    var value = fallback;
    if (nav){
      var rect = nav.getBoundingClientRect();
      var measured = Math.ceil(rect.bottom + 32);
      if (Number.isFinite(measured) && measured > 80) value = Math.max(fallback, measured);
    }
    section.style.setProperty('--svc-nav-offset', value + 'px');
    if (servicesPin) servicesPin.style.paddingTop = value + 'px';
    return value;
  }

  function servicesBuildScroll(){
    var mobile = servicesIsMobile();
    syncServicesNavOffset();
    servicesTween = gsap.to(servicesTrack, {
      x: function(){ return -servicesGetDist(); },
      ease: 'none',
      force3D: true,
      scrollTrigger: {
        trigger: servicesPin,
        /* Pin flush to the viewport top; padding-top on the pin clears the nav */
        start: 'top top',
        end: function(){ return '+=' + servicesGetDist(); },
        scrub: mobile ? 0.85 : 0.6,
        pin: servicesPin,
        pinSpacing: true,
        pinType: 'fixed',
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: function(){ syncServicesNavOffset(); }
      }
    });
  }

  function servicesTeardown(){
    if (servicesTween){
      if (servicesTween.scrollTrigger) servicesTween.scrollTrigger.kill();
      servicesTween.kill();
      servicesTween = null;
    }
    gsap.set(servicesTrack, { x: 0, clearProps: 'transform' });
    if (servicesPin) gsap.set(servicesPin, { clearProps: 'transform,pin' });
  }

  servicesMM.add('(min-width: 992px) and (prefers-reduced-motion: no-preference)', function(){
    servicesBuildScroll();
    return servicesTeardown;
  });

  servicesMM.add('(max-width: 991px) and (prefers-reduced-motion: no-preference)', function(){
    servicesBuildScroll();
    return servicesTeardown;
  });

  servicesMM.add('(prefers-reduced-motion: reduce)', function(){
    ScrollTrigger.getAll().forEach(function(st){
      if (st.trigger === servicesPin || st.trigger === servicesScroll) st.kill();
    });
    gsap.set(servicesTrack, { x: 0, clearProps: 'transform' });
    if (servicesPin) gsap.set(servicesPin, { clearProps: 'transform,pin' });
    return function(){ gsap.set(servicesTrack, { x: 0, clearProps: 'transform' }); };
  });

  function refreshScroll(){
    syncServicesNavOffset();
    ScrollTrigger.refresh(true);
    if (lenis) lenis.resize();
  }

  var refreshTimer;
  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshScroll, 120);
  }

  window.addEventListener('load', refreshScroll);
  window.addEventListener('resize', scheduleRefresh);
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(scheduleRefresh);
  }

  if (window.ResizeObserver && servicesViewport){
    var servicesRO = new ResizeObserver(scheduleRefresh);
    servicesRO.observe(servicesViewport);
    servicesRO.observe(servicesTrack);
  }

  if (document.body){
    var navReadyObs = new MutationObserver(function(){
      if (document.body.classList.contains('nav-ready')) scheduleRefresh();
    });
    navReadyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  setTimeout(refreshScroll, 800);
  setTimeout(refreshScroll, 2000);
  setTimeout(refreshScroll, 3800);
})();
