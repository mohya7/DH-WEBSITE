(function(){
  var nav = document.getElementById('nav');
  var burger = document.getElementById('navBurger');
  var mobileNav = document.getElementById('mobileNav');

  function onScroll(){
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  if(burger && mobileNav){
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
    if(link){
      link.addEventListener('mouseenter', open);
      link.addEventListener('focus', open);
    }
    item.addEventListener('mouseleave', close);
    item.addEventListener('focusout', function(e){
      if(!item.contains(e.relatedTarget)) close();
    });
  });

  var featureBlocks = document.querySelectorAll('[data-feature-block]');
  if('IntersectionObserver' in window){
    var fio = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var el = entry.target;
        var idx = Array.prototype.indexOf.call(featureBlocks, el);
        setTimeout(function(){ el.classList.add('is-visible'); }, idx * 60);
        fio.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    featureBlocks.forEach(function(el){ fio.observe(el); });
  } else {
    featureBlocks.forEach(function(el){ el.classList.add('is-visible'); });
  }

  var revealEls = document.querySelectorAll('[data-reveal]');
  var staggerIndex = 0;
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
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

  /* Problem pipeline â€” card hover sync + reduced-motion fallback */
  var problemPipeline = document.getElementById('problemPipeline');
  var problemPipelineStatus = document.getElementById('problemPipelineStatus');
  if (problemPipeline){
    var ppCards = problemPipeline.querySelectorAll('.pp-card');
    var ppStatusMsgs = [
      'Break 01 \u00b7 Integration gap',
      'Break 02 \u00b7 AI pipeline blocked',
      'Break 03 \u00b7 Workflow stalled'
    ];

    function problemPipelineLive(){
      problemPipeline.classList.add('is-live');
    }

    var reduceMotionNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotionNow){
      if ('IntersectionObserver' in window){
        var pio = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if (!entry.isIntersecting) return;
            problemPipeline.classList.add('is-animated');
            problemPipelineLive();
            pio.unobserve(entry.target);
          });
        }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
        pio.observe(problemPipeline);
      } else {
        problemPipeline.classList.add('is-animated');
        problemPipelineLive();
      }
    }

    ppCards.forEach(function(card, i){
      var brk = problemPipeline.querySelector('.pp-conn__break--' + (i + 1));
      card.addEventListener('mouseenter', function(){
        if (problemPipelineStatus) problemPipelineStatus.textContent = ppStatusMsgs[i];
        card.classList.add('is-active');
        if (brk) brk.classList.add('is-highlight');
      });
      card.addEventListener('mouseleave', function(){
        if (problemPipelineStatus) problemPipelineStatus.textContent = '3 critical break points';
        card.classList.remove('is-active');
        if (brk) brk.classList.remove('is-highlight');
      });
    });
  }

  var form = document.getElementById('contactForm');
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.textContent = 'Thank you — we\'ll respond within one business day';
      btn.disabled = true;
    });
  }
})();

/* Lenis smooth scroll + methodology wire animation */
(function(){
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
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

  function pageRefresh(){
    ScrollTrigger.refresh(true);
    if (lenis) lenis.resize();
  }

  var pageRefreshTimer;
  function pageScheduleRefresh(){
    clearTimeout(pageRefreshTimer);
    pageRefreshTimer = setTimeout(pageRefresh, 120);
  }

  window.addEventListener('load', pageRefresh);
  window.addEventListener('resize', pageScheduleRefresh);
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(pageScheduleRefresh);
  }

  /* Problem pipeline â€” scroll-linked reveal sequence */
  var problemPipelineEl = document.getElementById('problemPipeline');
  var problemPPST = null;
  var problemPPLive = false;

  function problemPipelineGoLive(){
    if (!problemPipelineEl || problemPPLive) return;
    problemPPLive = true;
    problemPipelineEl.classList.add('is-live');
  }

  function problemPipelineResetAnim(){
    if (problemPPST){
      problemPPST.kill();
      problemPPST = null;
    }
    if (!problemPipelineEl) return;
    problemPipelineEl.classList.remove('is-animated');
    problemPPLive = false;
    problemPipelineEl.classList.remove('is-live');
  }

  function problemPipelineBuildAnim(){
    problemPipelineResetAnim();
    if (!problemPipelineEl || reduceMotion) return;

    var ppCanvas = problemPipelineEl.querySelector('.pp-canvas');
    var ppNodes = problemPipelineEl.querySelectorAll('.pp-node');
    var ppLines = problemPipelineEl.querySelectorAll('.pp-conn__line');
    var ppBreaks = problemPipelineEl.querySelectorAll('.pp-conn__break');
    var ppCards = problemPipelineEl.querySelectorAll('.pp-card');
    if (!ppCanvas || !ppNodes.length) return;

    gsap.set(ppCanvas, { opacity: 0, y: 32 });
    gsap.set(ppNodes, { opacity: 0, y: 20, scale: 0.92 });
    gsap.set(ppLines, { scaleX: 0, opacity: 0.55 });
    gsap.set(ppBreaks, { scale: 0, opacity: 0 });
    gsap.set(ppCards, { opacity: 0, y: 24 });

    var ppTl = gsap.timeline({ paused: true });
    ppTl.to(ppCanvas, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    ppTl.to(ppNodes[0], { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' }, '-=0.12');

    for (var pi = 0; pi < ppLines.length; pi++){
      ppTl.to(ppLines[pi], { scaleX: 1, opacity: 1, duration: 0.22, ease: 'power1.inOut' }, '-=0.04');
      ppTl.to(ppBreaks[pi], { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(2)' }, '-=0.06');
      if (ppNodes[pi + 1]){
        ppTl.to(ppNodes[pi + 1], { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' }, '-=0.08');
      }
    }

    ppTl.to(ppCards, {
      opacity: 1,
      y: 0,
      duration: 0.32,
      stagger: 0.09,
      ease: 'power2.out'
    }, '-=0.04');

    problemPPST = ScrollTrigger.create({
      trigger: problemPipelineEl,
      start: 'top 85%',
      end: 'top 20%',
      scrub: 0.65,
      animation: ppTl,
      invalidateOnRefresh: true,
      onUpdate: function(self){
        if (self.progress >= 0.98){
          problemPipelineEl.classList.add('is-animated');
          problemPipelineGoLive();
        }
      },
      onLeave: function(){
        problemPipelineEl.classList.add('is-animated');
        problemPipelineGoLive();
      }
    });
  }

  var problemPPMM = gsap.matchMedia();
  problemPPMM.add('(prefers-reduced-motion: no-preference)', function(){
    problemPipelineBuildAnim();
    return problemPipelineResetAnim;
  });

  /* Cinematic capability deck â€” pin + scrub scenes */
  var eswdDeck       = document.getElementById('eswdDeck');
  var eswdStage      = document.getElementById('eswdStage');
  var eswdMenu       = document.getElementById('eswdMenu');
  var eswdProgressBar = document.getElementById('eswdProgressBar');
  var eswdSceneNum   = document.getElementById('eswdSceneNum');
  var eswdSceneName  = document.getElementById('eswdSceneName');
  var eswdStageGlow  = document.getElementById('eswdStageGlow');

  if (eswdDeck && eswdStage && eswdMenu){
    var eswdScenes = eswdStage.querySelectorAll('.eswd-scene');
    var eswdItems  = eswdMenu.querySelectorAll('.eswd-menu__item');
    var eswdTotal  = eswdScenes.length;
    var eswdActive = -1;

    eswdScenes.forEach(function(scene){
      var img = scene.querySelector('.eswd-scene__photo img');
      if (!img) return;
      img.loading = 'eager';
      if (!img.complete){
        var preload = new Image();
        preload.src = img.currentSrc || img.src;
      }
    });

    function eswdUpdateProgress(idx){
      if (!eswdProgressBar) return;
      eswdProgressBar.style.width = (Math.min(eswdTotal, idx + 1) / eswdTotal * 100) + '%';
    }

    function eswdPinTop(){
      var nav = document.getElementById('nav');
      if (!nav) return 120;
      var rect = nav.getBoundingClientRect();
      return Math.ceil(rect.top + rect.height + 20);
    }
    function eswdSyncPinTop(){
      var top = eswdPinTop();
      document.documentElement.style.setProperty('--eswd-pin-top', top + 'px');
      return top;
    }
    eswdSyncPinTop();
    window.addEventListener('resize', function(){
      eswdSyncPinTop();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    }, {passive:true});

    var eswdGlowColors = [
      'radial-gradient(ellipse 60% 50% at 50% 45%,rgba(54,176,229,0.32),transparent 70%)',
      'radial-gradient(ellipse 60% 50% at 50% 45%,rgba(120,200,235,0.32),transparent 70%)',
      'radial-gradient(ellipse 60% 50% at 50% 45%,rgba(244,151,11,0.32),transparent 70%)',
      'radial-gradient(ellipse 60% 50% at 50% 45%,rgba(34,184,132,0.32),transparent 70%)'
    ];

    function eswdScrollMenuToItem(item, idx){
      if (!eswdMenu || !item) return;
      requestAnimationFrame(function(){
        var pad = 8;
        var itemTop = item.offsetTop;
        var itemBottom = itemTop + item.offsetHeight;
        var viewTop = eswdMenu.scrollTop;
        var viewBottom = viewTop + eswdMenu.clientHeight;
        if (idx === eswdTotal - 1){
          eswdMenu.scrollTop = Math.max(0, itemBottom - eswdMenu.clientHeight + pad);
        } else if (idx === 0){
          eswdMenu.scrollTop = 0;
        } else if (itemTop < viewTop){
          eswdMenu.scrollTop = Math.max(0, itemTop - pad);
        } else if (itemBottom > viewBottom){
          eswdMenu.scrollTop = itemBottom - eswdMenu.clientHeight + pad;
        }
      });
    }

    function eswdSetActive(idx){
      if (idx < 0) idx = 0;
      if (idx > eswdTotal - 1) idx = eswdTotal - 1;
      if (idx === eswdActive) return;
      eswdActive = idx;
      eswdScenes.forEach(function(s, i){ s.classList.toggle('is-active', i === idx); });
      eswdItems.forEach(function(it, i){ it.classList.toggle('is-active', i === idx); });
      if (eswdSceneNum) eswdSceneNum.textContent = String(idx + 1).padStart(2, '0');
      if (eswdSceneName){
        var activeItem = eswdItems[idx];
        var title = activeItem ? activeItem.querySelector('.eswd-menu__title') : null;
        if (title) eswdSceneName.textContent = title.textContent;
      }
      if (eswdStageGlow && eswdGlowColors[idx]){
        eswdStageGlow.style.background = eswdGlowColors[idx];
      }
      eswdUpdateProgress(idx);
      if (window.matchMedia('(min-width: 992px)').matches){
        eswdScrollMenuToItem(eswdItems[idx], idx);
        setTimeout(function(){ eswdScrollMenuToItem(eswdItems[idx], idx); }, 560);
      }
    }
    eswdSetActive(0);

    var eswdDeckMM = gsap.matchMedia();
    var eswdDeckST = null;

    eswdDeckMM.add('(min-width: 992px) and (prefers-reduced-motion: no-preference)', function(){
      eswdDeckST = ScrollTrigger.create({
        trigger: eswdDeck,
        start: function(){ return 'top top+=' + eswdSyncPinTop(); },
        end: function(){ return '+=' + Math.round(window.innerHeight * (eswdTotal - 0.2)); },
        pin: true,
        pinSpacing: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: function(self){
          var p = self.progress;
          var idx = Math.min(eswdTotal - 1, Math.floor(p * eswdTotal));
          eswdSetActive(idx);
          if (eswdProgressBar){
            eswdProgressBar.style.width = (Math.min(1, p) * 100) + '%';
          }
        }
      });
      return function(){
        if (eswdDeckST){ eswdDeckST.kill(); eswdDeckST = null; }
      };
    });

    eswdDeckMM.add('(max-width: 991px)', function(){
      eswdDeck.classList.add('eswd-deck--static');
      if (eswdStage) eswdStage.setAttribute('aria-hidden', 'true');
      var progress = eswdDeck.querySelector('.eswd-deck__progress');
      if (progress) progress.hidden = true;

      var clones = [];
      eswdItems.forEach(function(it, i){
        it.classList.add('is-active');
        it.setAttribute('aria-disabled', 'true');
        it.tabIndex = -1;
        var scene = eswdScenes[i];
        if (!scene || it.querySelector('.eswd-menu__media')) return;
        var media = document.createElement('div');
        media.className = 'eswd-menu__media';
        var label = scene.querySelector('.eswd-scene__label');
        if (label) media.appendChild(label.cloneNode(true));
        var photo = scene.querySelector('.eswd-scene__photo');
        if (photo) media.appendChild(photo.cloneNode(true));
        it.insertBefore(media, it.firstChild);
        clones.push(media);
      });

      return function(){
        eswdDeck.classList.remove('eswd-deck--static');
        if (eswdStage) eswdStage.removeAttribute('aria-hidden');
        if (progress) progress.hidden = false;
        clones.forEach(function(node){
          if (node.parentNode) node.parentNode.removeChild(node);
        });
        eswdItems.forEach(function(it){
          it.classList.remove('is-active');
          it.removeAttribute('aria-disabled');
          it.tabIndex = 0;
        });
        eswdSetActive(0);
      };
    });

    eswdDeckMM.add('(prefers-reduced-motion: reduce) and (min-width: 992px)', function(){
      eswdSetActive(0);
      return function(){};
    });

    eswdItems.forEach(function(it, i){
      it.addEventListener('click', function(){
        if (eswdDeck.classList.contains('eswd-deck--static')) return;
        if (eswdDeckST){
          var p = (i + 0.5) / eswdTotal;
          var target = eswdDeckST.start + (eswdDeckST.end - eswdDeckST.start) * p;
          if (window.__lenis){
            window.__lenis.scrollTo(target, { duration: 0.8 });
          } else {
            window.scrollTo({ top: target, behavior: 'smooth' });
          }
        } else {
          it.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  /* Methodology wire â€” scroll-drawn path through cards */
  var methodSection = document.getElementById('method');
  var methodRows    = document.getElementById('methodRows');
  var methodWire    = document.getElementById('methodWire');
  var methodWireLine = document.getElementById('methodWireLine');
  var methodWireBg   = document.getElementById('methodWireBg');
  var methodWireDot  = document.getElementById('methodWireDot');
  var methodWireNodes = document.getElementById('methodWireNodes');
  var methodWireWrap  = methodRows ? methodRows.querySelector('.method-wire-wrap') : null;
  var methodWireST   = null;
  var methodWireLen  = 0;

  function methodWireSetNodes(nodes){
    if (!methodWireNodes) return;
    methodWireNodes.innerHTML = nodes.map(function(n){
      return '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + n.r + '"/>';
    }).join('');
  }

  function methodBuildPath(){
    if (!methodRows || !methodWireWrap || !methodWire || !methodWireLine || !methodWireBg) return 0;

    var rows = methodRows.querySelectorAll('.method-row');
    if (!rows.length) return 0;

    var rowsRect = methodRows.getBoundingClientRect();
    var wrapRect = methodWireWrap.getBoundingClientRect();
    var w = Math.max(Math.round(wrapRect.width), 1);
    var h = Math.max(Math.round(rowsRect.height), 1);
    methodWire.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    methodWire.setAttribute('width', w);
    methodWire.setAttribute('height', h);

    var spineX = Math.round(w * 0.5);
    var anchors = [];
    rows.forEach(function(row){
      var node = row.querySelector('.method-spine-node');
      if (!node) return;
      var r = node.getBoundingClientRect();
      anchors.push(Math.round(r.top - rowsRect.top + r.height * 0.5));
    });
    if (!anchors.length) return 0;

    anchors.sort(function(a, b){ return a - b; });

    var startY = Math.max(8, anchors[0] - 36);
    var endY = Math.min(h - 8, anchors[anchors.length - 1] + 36);
    var nodes = [{ x: spineX, y: startY, r: 3 }];
    var d = 'M ' + spineX + ' ' + startY;

    anchors.forEach(function(y){
      d += ' L ' + spineX + ' ' + y;
      nodes.push({ x: spineX, y: y, r: 4 });
    });

    d += ' L ' + spineX + ' ' + endY;
    nodes.push({ x: spineX, y: endY, r: 3 });

    methodWireSetNodes(nodes);
    methodWireLine.setAttribute('d', d);
    methodWireBg.setAttribute('d', d);

    methodWireLen = methodWireLine.getTotalLength();
    methodWireLine.style.strokeDasharray = methodWireLen;
    methodWireLine.style.strokeDashoffset = methodWireLen;
    methodWireBg.style.strokeDasharray = methodWireLen;
    methodWireBg.style.strokeDashoffset = 0;

    return methodWireLen;
  }

  function methodWireTeardown(){
    if (methodWireST){
      methodWireST.kill();
      methodWireST = null;
    }
    if (methodSection) methodSection.classList.remove('is-wire-active');
    if (methodWireLine && methodWireLen){
      methodWireLine.style.strokeDashoffset = methodWireLen;
    }
    if (methodWireDot){
      methodWireDot.setAttribute('cx', 0);
      methodWireDot.setAttribute('cy', 0);
    }
    if (methodWireNodes) methodWireNodes.innerHTML = '';
  }

  function methodWireBuild(){
    methodWireTeardown();
    if (reduceMotion) return;

    methodBuildPath();
    if (!methodWireLen || !methodSection || !methodRows) return;

    var rows = methodRows.querySelectorAll('.method-row');
    var firstRow = rows[0];
    var lastRow = rows[rows.length - 1];
    var firstCard = firstRow ? firstRow.querySelector('.method-frame') : null;
    var lastCard = lastRow ? lastRow.querySelector('.method-frame') : null;
    if (!firstCard) return;

    methodWireST = ScrollTrigger.create({
      trigger: firstCard,
      start: 'center center',
      endTrigger: lastCard || lastRow || methodSection,
      end: lastCard ? 'center center' : 'bottom 28%',
      scrub: 0.45,
      invalidateOnRefresh: true,
      onEnter: function(){ methodSection.classList.add('is-wire-active'); },
      onLeave: function(){ methodSection.classList.add('is-wire-active'); },
      onEnterBack: function(){ methodSection.classList.add('is-wire-active'); },
      onLeaveBack: function(){
        methodSection.classList.remove('is-wire-active');
        if (methodWireLine) methodWireLine.style.strokeDashoffset = methodWireLen;
        if (methodWireDot){
          methodWireDot.setAttribute('cx', 0);
          methodWireDot.setAttribute('cy', 0);
        }
      },
      onUpdate: function(self){
        var drawn = methodWireLen * self.progress;
        methodWireLine.style.strokeDashoffset = methodWireLen - drawn;
        if (methodWireDot && drawn > 0){
          var pt = methodWireLine.getPointAtLength(drawn);
          methodWireDot.setAttribute('cx', pt.x);
          methodWireDot.setAttribute('cy', pt.y);
        }
      }
    });
  }

  var methodWireMM = gsap.matchMedia();
  methodWireMM.add('(min-width: 841px) and (prefers-reduced-motion: no-preference)', function(){
    methodWireBuild();
    return methodWireTeardown;
  });
  methodWireMM.add('(max-width: 840px), (prefers-reduced-motion: reduce)', function(){
    methodWireTeardown();
  });

  function methodWireRefresh(){
    if (window.matchMedia('(min-width: 841px) and (prefers-reduced-motion: no-preference)').matches){
      methodBuildPath();
      ScrollTrigger.refresh(true);
    }
  }

  window.addEventListener('resize', methodWireRefresh);
  window.addEventListener('load', methodWireRefresh);
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(methodWireRefresh);
  }
  if (window.ResizeObserver && methodRows){
    var methodRO = new ResizeObserver(methodWireRefresh);
    methodRO.observe(methodRows);
    if (methodWireWrap) methodRO.observe(methodWireWrap);
  }
  setTimeout(methodWireRefresh, 900);
  setTimeout(methodWireRefresh, 2200);
})();
