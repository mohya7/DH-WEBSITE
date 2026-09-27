
(function(){
  'use strict';

  /* ----------------------------------------------------------
     HERO ENTRANCE ? laser typewriter for H1
  ---------------------------------------------------------- */
  function initLaserH1(){
    var wrap = document.querySelector('.h1-wrap');
    if (!wrap) return [];
    var lines = wrap.querySelectorAll('.h1-line > span');
    var chars = [];
    lines.forEach(function(line){
      var text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden','true');
      // Split into words (keep spaces) so words don't break across lines
      var tokens = text.split(/(\s+)/);
      tokens.forEach(function(token){
        if (token.length === 0) return;
        if (/^\s+$/.test(token)){
          line.appendChild(document.createTextNode(' '));
          return;
        }
        var word = document.createElement('span');
        word.className = 'word';
        Array.from(token).forEach(function(ch){
          var s = document.createElement('span');
          s.className = 'ch';
          s.textContent = ch;
          word.appendChild(s);
          chars.push(s);
        });
        line.appendChild(word);
      });
    });
    wrap.classList.add('ready');
    return chars;
  }

  function startLaserType(chars){
    var startDelay = 250;
    var perChar = 38;
    chars.forEach(function(ch, i){
      setTimeout(function(){ ch.classList.add('in'); }, startDelay + i * perChar);
    });
  }

  // Split immediately so the H1 doesn't flash visible before being chunked
  var h1Chars = initLaserH1();

  /* ----------------------------------------------------------
     NAV INTRO ? center logo ? move to nav-left ? open L?R
  ---------------------------------------------------------- */
  var navIntroCtrl = { abort: null };
  var introSequenceDone = false;
  var INTRO_HARD_CAP_MS = 6500;

  function markHomeIntroPlayed(){
    try { sessionStorage.setItem('dh-home-intro', '1'); } catch (e) {}
  }

  function shouldPlayHomeIntro(){
    return document.documentElement.dataset.dhIntro === 'play';
  }

  function finishHeroEntrance(){
    if (introSequenceDone) return;
    introSequenceDone = true;
    markHomeIntroPlayed();
    setIntroScrollLock(false);
    document.body.classList.add('loaded');
    startLaserType(h1Chars);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function forceIntroComplete(){
    if (introSequenceDone) return;
    applyIntroFinalState();
    finishHeroEntrance();
  }

  if (shouldPlayHomeIntro()) setTimeout(forceIntroComplete, INTRO_HARD_CAP_MS);

  function isPageScrolled(){
    var lenis = window.__lenis;
    if (lenis && lenis.scroll > 0) return true;
    return (window.scrollY || document.documentElement.scrollTop) > 0;
  }

  function setIntroScrollLock(locked){
    document.documentElement.classList.toggle('intro-locked', locked);
    if (locked) document.documentElement.classList.add('intro-pending');
    else document.documentElement.classList.remove('intro-pending');
    if (window.__lenis){
      if (locked) window.__lenis.stop();
      else window.__lenis.start();
    }
    if (locked){
      if (!setIntroScrollLock._block){
        setIntroScrollLock._block = function(e){ e.preventDefault(); };
        window.addEventListener('wheel', setIntroScrollLock._block, { passive: false });
        window.addEventListener('touchmove', setIntroScrollLock._block, { passive: false });
      }
    } else if (setIntroScrollLock._block){
      window.removeEventListener('wheel', setIntroScrollLock._block);
      window.removeEventListener('touchmove', setIntroScrollLock._block);
      setIntroScrollLock._block = null;
    }
  }

  function showNav(){
    document.documentElement.classList.add('nav-shown');
    var nav = document.getElementById('nav');
    if (nav){
      nav.style.opacity = '1';
      nav.style.visibility = 'visible';
      nav.style.pointerEvents = 'auto';
    }
  }

  function unlockNavDropdowns(){
    var navWipe = document.querySelector('.nav-wipe');
    if (!navWipe) return;
    var cover = navWipe.querySelector('.nav-wipe-cover');
    navWipe.classList.add('is-revealed');
    navWipe.classList.remove('is-wiping');
    if (cover){
      cover.style.animation = 'none';
      cover.style.transform = 'scaleX(0)';
      cover.style.visibility = 'hidden';
      cover.style.opacity = '0';
    }
    showNav();
  }

  function playNavWipe(navWipe, done){
    if (!navWipe){
      if (done) done();
      return;
    }
    var cover = navWipe.querySelector('.nav-wipe-cover');
    if (!cover){
      if (done) done();
      return;
    }

    function finish(){
      if (finish._done) return;
      finish._done = true;
      unlockNavDropdowns();
      if (done) done();
    }

    navWipe.classList.remove('is-revealed', 'is-wiping');
    cover.style.visibility = 'visible';
    cover.style.opacity = '1';
    cover.style.removeProperty('transform');
    cover.style.removeProperty('animation');
    void cover.offsetWidth;
    navWipe.classList.add('is-wiping');
    showNav();

    function onCoverEnd(e){
      if (e && e.animationName && e.animationName !== 'navCoverWipe') return;
      cover.removeEventListener('animationend', onCoverEnd);
      finish();
    }
    cover.addEventListener('animationend', onCoverEnd);
    setTimeout(function(){
      cover.removeEventListener('animationend', onCoverEnd);
      finish();
    }, 1200);
  }

  function settleLogoInNav(){
    var intro = document.getElementById('navIntro');
    var brand = document.querySelector('.nav-inner .brand');
    if (!brand) return;
    if (brand.querySelector('.brand-logo')) return;
    var img = intro && intro.querySelector('.nav-intro-logo');
    if (img){
      img.classList.remove('nav-intro-logo');
      img.classList.add('brand-logo');
      img.alt = 'Digital Hub';
      brand.classList.add('has-logo');
      brand.appendChild(img);
    } else {
      var fallback = document.createElement('img');
      fallback.className = 'brand-logo';
      fallback.src = 'assets/digital-hub-logo.png';
      fallback.alt = 'Digital Hub';
      fallback.decoding = 'async';
      brand.classList.add('has-logo');
      brand.appendChild(fallback);
    }
    if (intro) intro.remove();
  }

  function applyIntroFinalState(){
    if (introSequenceDone) return;
    introSequenceDone = true;
    markHomeIntroPlayed();
    navIntroCtrl.abort = null;
    setIntroScrollLock(false);
    document.documentElement.classList.remove('intro-pending');
    document.body.classList.add('nav-ready', 'loaded', 'intro-grid-reveal');
    showNav();
    unlockNavDropdowns();
    settleLogoInNav();
    var intro = document.getElementById('navIntro');
    if (intro) intro.remove();
    if (window.__heroGridRevealInstant) window.__heroGridRevealInstant();
    h1Chars.forEach(function(ch){ ch.classList.add('in'); });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function runNavIntro(onAnimatedComplete, onSkip){
    var intro = document.getElementById('navIntro');
    var brand = document.querySelector('.nav-inner .brand');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timers = [];
    var scrollWatch = null;
    var scrollPollRaf = null;
    var aborted = false;
    var introActive = false;
    var flashFallbackTimer = null;

    function clearTimers(){
      timers.forEach(clearTimeout);
      timers.length = 0;
    }

    function cleanupWatch(){
      if (scrollPollRaf){
        cancelAnimationFrame(scrollPollRaf);
        scrollPollRaf = null;
      }
      if (scrollWatch){
        window.removeEventListener('scroll', scrollWatch);
        if (window.__lenis) window.__lenis.off('scroll', scrollWatch);
        scrollWatch = null;
      }
    }

    function onFlashComplete(e){
      if (e && e.animationName && e.animationName !== 'introLogoFlash') return;
      if (aborted || introActive) return;
      clearFlashWait();
      beginIntro();
    }

    function clearFlashWait(){
      if (flashFallbackTimer){
        clearTimeout(flashFallbackTimer);
        flashFallbackTimer = null;
      }
      if (intro){
        intro.classList.remove('is-flashing');
        var introLogo = intro.querySelector('.nav-intro-logo');
        if (introLogo) introLogo.removeEventListener('animationend', onFlashComplete);
      }
    }

    function skipIntro(){
      if (aborted) return;
      if (introActive) return;
      aborted = true;
      clearFlashWait();
      cleanupWatch();
      clearTimers();
      if (onSkip) onSkip();
      else applyIntroFinalState();
    }

    function pollScroll(){
      if (aborted) return;
      if (introActive){
        scrollPollRaf = requestAnimationFrame(pollScroll);
        return;
      }
      if (isPageScrolled()){
        skipIntro();
        return;
      }
      scrollPollRaf = requestAnimationFrame(pollScroll);
    }

    navIntroCtrl.abort = skipIntro;

    if (!intro || !brand || reduced){
      navIntroCtrl.abort = null;
      if (onSkip) onSkip();
      else applyIntroFinalState();
      return;
    }

    if (isPageScrolled()){
      skipIntro();
      return;
    }

    scrollWatch = function(){
      if (introActive) return;
      if (isPageScrolled()) skipIntro();
    };
    window.addEventListener('scroll', scrollWatch, { passive: true });
    if (window.__lenis) window.__lenis.on('scroll', scrollWatch);
    scrollPollRaf = requestAnimationFrame(pollScroll);

    function beginIntro(){
      if (aborted || isPageScrolled()){
        skipIntro();
        return;
      }
      clearFlashWait();
      introActive = true;
      cleanupWatch();

      var introBrand = intro.querySelector('.nav-intro-brand');
      var introLogo = intro.querySelector('.nav-intro-logo');
      if (introLogo){
        introLogo.style.animation = 'none';
        introLogo.style.opacity = '';
        introLogo.style.filter = '';
      }
      var brand = document.querySelector('.nav-inner .brand');
      var navInner = document.querySelector('.nav-inner');
      var navWipe = document.querySelector('.nav-wipe');
      var logoH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--brand-logo-h')) || 72;
      var introRect = introBrand.getBoundingClientRect();
      var targetRect = brand.getBoundingClientRect();
      var targetCx, targetCy, scale;
      if (targetRect.width < 1 && navInner){
        var navRect = navInner.getBoundingClientRect();
        var navPadL = parseFloat(getComputedStyle(navInner).paddingLeft) || 24;
        targetCx = navRect.left + navPadL + logoH / 2;
        targetCy = navRect.top + navRect.height / 2;
      } else {
        targetCx = targetRect.left + targetRect.width / 2;
        targetCy = targetRect.top + targetRect.height / 2;
      }
      var introCx = window.innerWidth / 2;
      var introCy = window.innerHeight / 2;
      var dx = targetCx - introCx;
      var dy = targetCy - introCy;
      /* Match final .brand-logo height so the handoff does not jump small → large */
      scale = logoH / Math.max(introRect.height, 1);

      intro.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(' + scale + ')';

      timers.push(setTimeout(function(){
        if (aborted) return;
        var navRevealFinished = false;

        function finishNavReveal(){
          if (navRevealFinished || aborted) return;
          navRevealFinished = true;
          navIntroCtrl.abort = null;
          settleLogoInNav();
        }

        document.body.classList.add('nav-ready');
        if (onAnimatedComplete) onAnimatedComplete();
        playNavWipe(navWipe, finishNavReveal);
      }, 1000));
    }

    function startPhase0(){
      if (aborted || isPageScrolled()){
        skipIntro();
        return;
      }
      setIntroScrollLock(true);
      var introLogo = intro.querySelector('.nav-intro-logo');
      if (!introLogo){
        beginIntro();
        return;
      }
      intro.classList.add('is-flashing');
      introLogo.addEventListener('animationend', onFlashComplete);
      flashFallbackTimer = setTimeout(function(){
        if (!aborted && !introActive) onFlashComplete();
      }, 2300);
    }

    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        timers.push(setTimeout(function(){
          if (!aborted) startPhase0();
        }, 0));
      });
    });
  }

  window.addEventListener('load', function(){
    if (!shouldPlayHomeIntro()){
      applyIntroFinalState();
      return;
    }
    runNavIntro(
      function(){
        if (introSequenceDone) return;
        setIntroScrollLock(false);
        var heroFinished = false;
        function doneHeroReveal(){
          if (heroFinished || introSequenceDone) return;
          heroFinished = true;
          finishHeroEntrance();
        }
        window.__heroGridReveal(doneHeroReveal);
        setTimeout(doneHeroReveal, 3800);
      },
      applyIntroFinalState
    );
  });

  window.addEventListener('pageshow', function(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if (!isPageScrolled()) return;
        if (navIntroCtrl.abort){
          navIntroCtrl.abort();
          return;
        }
        if (!document.body.classList.contains('nav-ready')) applyIntroFinalState();
      });
    });
  });

  /* ----------------------------------------------------------
     HERO SAND + GPU FLUID — BaseOne-style smoke (cursor unchanged)
     Implemented in js/hero-fluid.js
  ---------------------------------------------------------- */

  /* ----------------------------------------------------------
     NAV: scroll state
  ---------------------------------------------------------- */
  var nav = document.getElementById('nav');
  function onScroll(){
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  /* ----------------------------------------------------------
     MOBILE NAV
  ---------------------------------------------------------- */
  var burger = document.getElementById('navBurger');
  var mNav = document.getElementById('mobileNav');
  if (burger && mNav){
    burger.addEventListener('click', function(){
      var isOpen = mNav.classList.toggle('open');
      mNav.setAttribute('aria-hidden', String(!isOpen));
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.innerHTML = isOpen ? '<i class="ti ti-x"></i>' : '<i class="ti ti-menu-2"></i>';
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (window.__lenis) isOpen ? window.__lenis.stop() : window.__lenis.start();
    });
    mNav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        mNav.classList.remove('open');
        document.body.style.overflow = '';
        burger.innerHTML = '<i class="ti ti-menu-2"></i>';
        burger.setAttribute('aria-expanded','false');
      });
    });
  }

  /* ----------------------------------------------------------
     DROPDOWN: tap-to-open on touch + smooth hover on desktop
  ---------------------------------------------------------- */
  document.querySelectorAll('.has-dd').forEach(function(item){
    var closeTimer;
    item.addEventListener('mouseenter', function(){
      clearTimeout(closeTimer);
      if (window.matchMedia('(hover: hover)').matches) item.classList.add('is-hover');
    });
    item.addEventListener('mouseleave', function(e){
      if (!window.matchMedia('(hover: hover)').matches) return;
      var related = e.relatedTarget;
      if (related && item.contains(related)) return;
      var delay = 280;
      if (related && related.closest && related.closest('.nav-links .has-dd')) delay = 60;
      closeTimer = setTimeout(function(){
        item.classList.remove('is-hover');
      }, delay);
    });
  });
  document.querySelectorAll('.has-dd > .nav-link').forEach(function(trigger){
    trigger.addEventListener('click', function(e){
      var parent = trigger.parentElement;
      if (window.matchMedia('(hover: none)').matches){
        e.preventDefault();
        document.querySelectorAll('.has-dd.open').forEach(function(o){ if (o!==parent) o.classList.remove('open'); });
        parent.classList.toggle('open');
      }
    });
  });
  document.addEventListener('click', function(e){
    if (!e.target.closest('.has-dd')) {
      document.querySelectorAll('.has-dd.open').forEach(function(o){ o.classList.remove('open'); });
    }
  });

  /* ----------------------------------------------------------
     SCROLL REVEAL (IntersectionObserver)
  ---------------------------------------------------------- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  document.querySelectorAll('[data-reveal]').forEach(function(el){
    if (!el.closest('[data-section-reveal]')) io.observe(el);
  });

  var sectionIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      var section = entry.target;
      section.classList.add('in');
      var items = section.querySelectorAll('[data-reveal]');
      items.forEach(function(el, i){
        setTimeout(function(){ el.classList.add('in'); }, 120 + i * 100);
      });
      sectionIO.unobserve(section);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('[data-section-reveal]').forEach(function(el){
    sectionIO.observe(el);
  });

  /* ----------------------------------------------------------
     COUNTERS (easeOutQuart, 1400ms, 180ms stagger)
  ---------------------------------------------------------- */
  function easeOutQuart(t){ return 1 - Math.pow(1 - t, 4); }

  function animateCount(el, target, suffix, duration, delay){
    var start = null;
    el.classList.add('is-counting');
    function step(ts){
      if (!start) start = ts;
      var elapsed = ts - start;
      if (elapsed < delay){ requestAnimationFrame(step); return; }
      var p = Math.min((elapsed - delay) / duration, 1);
      var val = Math.floor(easeOutQuart(p) * target);
      el.textContent = val + (suffix || '');
      if (p < 1){
        requestAnimationFrame(step);
      } else {
        el.textContent = target + (suffix || '');
        el.classList.remove('is-counting');
        el.classList.add('is-done');
      }
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('.stat-num[data-count]');
  var countersStarted = false;
  var reduceMotionCounters = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var countersIO = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting && !countersStarted){
        countersStarted = true;
        if (reduceMotionCounters){
          counters.forEach(function(el){
            var target = parseInt(el.getAttribute('data-count'), 10);
            var suffix = el.getAttribute('data-suffix') || '';
            el.textContent = target + suffix;
          });
        } else {
          counters.forEach(function(el, i){
            var target = parseInt(el.getAttribute('data-count'), 10);
            var suffix = el.getAttribute('data-suffix') || '';
            animateCount(el, target, suffix, 1400, i * 180);
          });
        }
        countersIO.disconnect();
      }
    });
  }, { threshold: 0.35 });
  if (counters.length){
    countersIO.observe(counters[0].closest('.numbers-row') || counters[0].closest('.numbers'));
  }

  /* ----------------------------------------------------------
     MARQUEE: ensure speed adjusts to content length
     (CSS uses keyframes; here we just keep things accessible)
  ---------------------------------------------------------- */
  // Pause all marquees on hover handled via CSS

  /* ----------------------------------------------------------
     CONTACT FORM: dynamic CTA
  ---------------------------------------------------------- */
  var situation = document.getElementById('situation');
  var submitText = document.getElementById('submitText');
  var defaultCta = 'Send ? we?ll respond within 24 hours';
  var ctaMap = {
    gov:   'Request a government assessment',
    dx:    'Get my free DX roadmap',
    dex:   'Request a Nexthink DEX health check',
    other: defaultCta
  };
  function updateCta(){
    var v = situation.value;
    submitText.textContent = ctaMap[v] || defaultCta;
  }
  if (situation){
    situation.addEventListener('change', updateCta);
    updateCta();
  }

  var form = document.getElementById('contactForm');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var prev = submitText.textContent;
      submitText.textContent = 'Thank you ? message received';
      btn.style.background = 'var(--teal)';
      btn.disabled = true;
      setTimeout(function(){
        form.reset();
        updateCta();
        btn.style.background = '';
        btn.disabled = false;
      }, 2400);
    });
  }

})();
