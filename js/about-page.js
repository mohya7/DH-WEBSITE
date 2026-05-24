(function(){
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.getElementById('nav');
  var burger = document.getElementById('navBurger');
  var mobileNav = document.getElementById('mobileNav');

  function onScroll(){
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (burger && mobileNav){
    burger.addEventListener('click', function(){
      var open = mobileNav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      mobileNav.setAttribute('aria-hidden', !open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  document.querySelectorAll('.has-dd').forEach(function(item){
    var link = item.querySelector('.nav-link');
    var leaveTimer;
    function open(){ clearTimeout(leaveTimer); item.classList.add('open'); }
    function close(){ leaveTimer = setTimeout(function(){ item.classList.remove('open'); }, 120); }
    if (link){
      link.addEventListener('mouseenter', open);
      link.addEventListener('focus', open);
    }
    item.addEventListener('mouseleave', close);
    item.addEventListener('focusout', function(e){
      if (!item.contains(e.relatedTarget)) close();
    });
  });

  var revealEls = document.querySelectorAll('[data-reveal]');
  var staggerIndex = 0;
  if ('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = el.hasAttribute('data-stagger') ? (staggerIndex++ * 120) : 0;
        setTimeout(function(){ el.classList.add('in'); }, delay);
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

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

  var counters = document.querySelectorAll('#stats .stat-num[data-count]');
  if (counters.length && 'IntersectionObserver' in window){
    var countersStarted = false;
    var countersIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!entry.isIntersecting || countersStarted) return;
        countersStarted = true;
        if (reduceMotion){
          counters.forEach(function(el){
            var target = parseInt(el.getAttribute('data-count'), 10);
            var suffix = el.getAttribute('data-suffix') || '';
            el.textContent = target + suffix;
            el.classList.add('is-done');
          });
        } else {
          counters.forEach(function(el, i){
            var target = parseInt(el.getAttribute('data-count'), 10);
            var suffix = el.getAttribute('data-suffix') || '';
            animateCount(el, target, suffix, 1400, i * 180);
          });
        }
        countersIO.disconnect();
      });
    }, { threshold: 0.35 });
    countersIO.observe(document.querySelector('#stats .numbers-row') || document.getElementById('stats'));
  }

  var teamStrip = document.getElementById('teamStrip');
  var teamViewport = document.getElementById('teamStripViewport');
  var teamInner = document.getElementById('teamStripInner');
  var teamProgress = document.getElementById('teamStripProgress');
  var teamPrev = document.getElementById('teamStripPrev');
  var teamNext = document.getElementById('teamStripNext');

  if (teamStrip && teamViewport && teamInner){
    var stripState = { x: 0, minX: 0, dragging: false, moved: 0, startX: 0, startTx: 0, lastX: 0, lastT: 0, vx: 0 };
    var stripTween;
    var canDrag = !reduceMotion && window.matchMedia('(hover: hover) and (min-width: 901px)').matches;

    function stripClamp(x){
      return Math.max(stripState.minX, Math.min(0, x));
    }

    function stripApply(x){
      stripState.x = stripClamp(x);
      teamInner.style.transform = 'translate3d(' + stripState.x + 'px,0,0)';
      if (teamProgress){
        var range = stripState.minX || -1;
        var progress = range ? stripState.x / range : 0;
        teamProgress.style.transform = 'scaleX(' + progress + ')';
      }
      stripUpdateArrows();
    }

    function stripStep(){
      var item = teamInner.querySelector('.team-strip__item');
      if (!item) return 280;
      var gap = parseFloat(getComputedStyle(teamInner).columnGap || getComputedStyle(teamInner).gap) || 0;
      return item.offsetWidth + gap;
    }

    function stripUpdateArrows(){
      if (!teamPrev || !teamNext) return;
      if (canDrag){
        teamPrev.disabled = stripState.x >= -1;
        teamNext.disabled = stripState.x <= stripState.minX + 1;
        return;
      }
      var maxScroll = teamViewport.scrollWidth - teamViewport.clientWidth;
      teamPrev.disabled = teamViewport.scrollLeft <= 1;
      teamNext.disabled = teamViewport.scrollLeft >= maxScroll - 1;
    }

    function stripAnimateTo(x){
      var target = stripClamp(x);
      if (stripTween) stripTween.kill();
      if (typeof gsap !== 'undefined' && !reduceMotion){
        stripTween = gsap.to(stripState, {
          x: target,
          duration: 0.6,
          ease: 'power3.out',
          onUpdate: function(){ stripApply(stripState.x); }
        });
      } else {
        stripApply(target);
      }
    }

    function stripScrollBy(direction){
      if (canDrag){
        stripAnimateTo(stripState.x - direction * stripStep());
        return;
      }
      teamViewport.scrollBy({ left: direction * stripStep(), behavior: reduceMotion ? 'auto' : 'smooth' });
      window.setTimeout(stripUpdateArrows, reduceMotion ? 0 : 320);
    }

    function stripMeasure(){
      var vw = teamViewport.offsetWidth;
      var iw = teamInner.scrollWidth;
      stripState.minX = Math.min(0, vw - iw);
      stripApply(stripState.x);
    }

    function stripEndDrag(e){
      if (!stripState.dragging) return;
      stripState.dragging = false;
      teamStrip.classList.remove('is-dragging');
      if (e && e.pointerId != null){
        try { teamViewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      if (reduceMotion){
        stripApply(stripState.x);
        return;
      }
      var inertia = stripState.vx * 220;
      var target = stripClamp(stripState.x + inertia);
      if (typeof gsap !== 'undefined'){
        if (stripTween) stripTween.kill();
        stripTween = gsap.to(stripState, {
          x: target,
          duration: 0.85,
          ease: 'power3.out',
          onUpdate: function(){ stripApply(stripState.x); }
        });
      } else {
        stripApply(target);
      }
    }

    teamViewport.addEventListener('pointerdown', function(e){
      if (e.target.closest('.team-card__action')) return;
      if (!canDrag && e.pointerType === 'mouse') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stripState.dragging = true;
      stripState.moved = 0;
      stripState.startX = e.clientX;
      stripState.startTx = stripState.x;
      stripState.lastX = e.clientX;
      stripState.lastT = Date.now();
      stripState.vx = 0;
      if (stripTween) stripTween.kill();
      teamStrip.classList.add('is-dragging');
      teamViewport.setPointerCapture(e.pointerId);
    });

    teamViewport.addEventListener('pointermove', function(e){
      if (!stripState.dragging) return;
      stripState.moved = Math.max(stripState.moved, Math.abs(e.clientX - stripState.startX));
      var next = stripState.startTx + (e.clientX - stripState.startX);
      stripApply(next);
      var now = Date.now();
      var dt = now - stripState.lastT;
      if (dt > 0) stripState.vx = (e.clientX - stripState.lastX) / dt;
      stripState.lastX = e.clientX;
      stripState.lastT = now;
    });

    teamViewport.addEventListener('pointerup', stripEndDrag);
    teamViewport.addEventListener('pointercancel', stripEndDrag);
    teamViewport.addEventListener('pointerleave', function(){
      if (stripState.dragging) stripEndDrag(null);
    });

    teamViewport.addEventListener('keydown', function(e){
      if (e.key === 'ArrowLeft'){ e.preventDefault(); stripScrollBy(-1); }
      if (e.key === 'ArrowRight'){ e.preventDefault(); stripScrollBy(1); }
    });

    teamViewport.addEventListener('scroll', stripUpdateArrows);

    if (teamPrev) teamPrev.addEventListener('click', function(){ stripScrollBy(-1); });
    if (teamNext) teamNext.addEventListener('click', function(){ stripScrollBy(1); });

    teamStrip.querySelectorAll('.team-card__action--linkedin[href="#"]').forEach(function(link){
      link.addEventListener('click', function(e){ e.preventDefault(); });
    });

    window.addEventListener('resize', stripMeasure);
    stripMeasure();
  }

  var form = document.getElementById('contactForm');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.textContent = 'Thank you — we\'ll respond within one business day';
      btn.disabled = true;
    });
  }
})();

(function(){
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;

  if (!reduceMotion && typeof Lenis !== 'undefined'){
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop: function(value){
        if (arguments.length) lenis.scrollTo(value, { immediate: true });
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

  var constellation = document.getElementById('aboutConstellation');
  if (constellation && !reduceMotion){
    var cCanvas = constellation.querySelector('.pp-canvas');
    var cNodes = constellation.querySelectorAll('.pp-node');
    var cLines = constellation.querySelectorAll('.pp-conn__line');
    gsap.set(cCanvas, { opacity: 0, y: 28 });
    gsap.set(cNodes, { opacity: 0, y: 18, scale: 0.94 });
    gsap.set(cLines, { scaleX: 0, opacity: 0.5 });
    var cTl = gsap.timeline({ paused: true });
    cTl.to(cCanvas, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    cTl.to(cNodes[0], { opacity: 1, y: 0, scale: 1, duration: 0.28 }, '-=0.1');
    for (var ci = 0; ci < cLines.length; ci++){
      cTl.to(cLines[ci], { scaleX: 1, opacity: 1, duration: 0.22 }, '-=0.06');
      if (cNodes[ci + 1]) cTl.to(cNodes[ci + 1], { opacity: 1, y: 0, scale: 1, duration: 0.28 }, '-=0.08');
    }
    ScrollTrigger.create({
      trigger: constellation,
      start: 'top 82%',
      end: 'top 25%',
      scrub: 0.6,
      animation: cTl,
      onLeave: function(){ constellation.classList.add('is-live'); }
    });
  } else if (constellation){
    constellation.classList.add('is-live');
  }

  /* ── Jisr-style history timeline ── */
  (function(){
    var wrap = document.getElementById('jtlWrap');
    if (!wrap) return;

    var items = wrap.querySelectorAll('.jtl-item');
    var slides = wrap.querySelectorAll('.jtl-slide');
    var fill = wrap.querySelector('.jtl-line__fill');
    var track = wrap.querySelector('.jtl-track');
    var line = wrap.querySelector('.jtl-line');
    var activeIndex = -1;
    var scrollTrigger = null;
    var userPicked = false;
    var pickTimer;

    function layoutLine(){
      if (!track || !line) return;
      var dots = wrap.querySelectorAll('.jtl-dot');
      if (dots.length < 2) return;
      var tr = track.getBoundingClientRect();
      var first = dots[0].getBoundingClientRect();
      var last = dots[dots.length - 1].getBoundingClientRect();
      var firstY = first.top + first.height / 2 - tr.top;
      var lastY = last.top + last.height / 2 - tr.top;
      line.style.top = Math.round(firstY) + 'px';
      line.style.bottom = Math.round(tr.height - lastY) + 'px';
    }

    function setActive(index, opts){
      opts = opts || {};
      if (index < 0 || index >= items.length) return;
      if (!opts.force && index === activeIndex) return;
      activeIndex = index;

      items.forEach(function(item, i){
        var on = i === index;
        item.classList.toggle('is-active', on);
        var btn = item.querySelector('.jtl-item__btn');
        if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      slides.forEach(function(slide, i){
        slide.classList.toggle('is-active', i === index);
      });

      if (fill && !opts.skipFill){
        if (opts.animateFill !== false){
          fill.style.transition = '';
        } else {
          fill.style.transition = 'none';
        }
        if (items.length > 1){
          fill.style.height = (index / (items.length - 1) * 100) + '%';
        } else {
          fill.style.height = '100%';
        }
      }
    }

    function setProgress(progress){
      progress = Math.max(0, Math.min(1, progress));
      if (fill){
        fill.style.transition = 'none';
        fill.style.height = (progress * 100) + '%';
      }
      var index = items.length > 1
        ? Math.min(items.length - 1, Math.round(progress * (items.length - 1)))
        : 0;
      setActive(index, { skipFill: true });
    }

    function scrollSpan(){
      return Math.max(420, window.innerHeight * 0.72);
    }

    items.forEach(function(item, i){
      var btn = item.querySelector('.jtl-item__btn');
      if (!btn) return;
      btn.addEventListener('click', function(){
        userPicked = true;
        clearTimeout(pickTimer);
        pickTimer = setTimeout(function(){ userPicked = false; }, 1400);
        setActive(i, { force: true, animateFill: true });
        if (scrollTrigger){
          var p = items.length > 1 ? i / (items.length - 1) : 1;
          var start = scrollTrigger.start;
          var end = scrollTrigger.end;
          var target = start + (end - start) * p;
          if (lenis){
            lenis.scrollTo(target, { duration: 0.85, easing: function(t){ return 1 - Math.pow(1 - t, 3); } });
          } else {
            window.scrollTo({ top: target, behavior: 'smooth' });
          }
        }
      });
    });

    function reveal(){
      wrap.classList.add('is-ready');
      if (activeIndex < 0) setActive(0, { force: true });
      requestAnimationFrame(layoutLine);
    }

    layoutLine();
    window.addEventListener('resize', layoutLine);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutLine);

    if (typeof ScrollTrigger !== 'undefined' && !reduceMotion){
      ScrollTrigger.create({
        trigger: wrap,
        start: 'top 82%',
        onEnter: reveal,
        once: true
      });

      scrollTrigger = ScrollTrigger.create({
        trigger: wrap,
        start: 'top 70%',
        end: function(){ return '+=' + scrollSpan(); },
        scrub: 1.1,
        invalidateOnRefresh: true,
        onUpdate: function(self){
          if (userPicked) return;
          setProgress(self.progress);
        }
      });
    } else {
      var io = new IntersectionObserver(function(entries){
        if (entries[0].isIntersecting){
          reveal();
          io.disconnect();
        }
      }, { threshold: 0.15 });
      io.observe(wrap);
    }
  }());

})();
