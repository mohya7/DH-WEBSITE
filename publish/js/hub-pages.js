(function(){
  'use strict';

  document.querySelectorAll('.hub-filters').forEach(function(group){
    var filters = group.querySelectorAll('.hub-filter');
    var grid = group.nextElementSibling;
    if (!filters.length || !grid) return;

    var cards = grid.querySelectorAll('[data-category]');
    if (!cards.length) return;

    filters.forEach(function(btn){
      btn.addEventListener('click', function(){
        var cat = btn.getAttribute('data-filter') || 'all';
        filters.forEach(function(b){
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        cards.forEach(function(card){
          var categories = (card.getAttribute('data-category') || '').split(/\s+/);
          var match = cat === 'all' || categories.indexOf(cat) !== -1;
          card.classList.toggle('is-hidden', !match);
        });
      });
    });
  });

  var featureBlocks = document.querySelectorAll('[data-stagger-item]');
  if ('IntersectionObserver' in window && featureBlocks.length){
    var fio = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var idx = Array.prototype.indexOf.call(featureBlocks, el);
        setTimeout(function(){ el.classList.add('in'); }, idx * 80);
        fio.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    featureBlocks.forEach(function(el){ fio.observe(el); });
  }

  var overviews = document.querySelectorAll('.page-partner-view .partner-overview');
  if (overviews.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var armedY = null;
    var cleared = false;
    var armTimer = null;

    function clearOverviewBlur(){
      if (cleared) return;
      cleared = true;
      if (armTimer) clearTimeout(armTimer);
      overviews.forEach(function(el){
        el.classList.remove('is-blurred');
        el.classList.add('is-clear');
      });
      window.removeEventListener('scroll', onOverviewScroll);
      visIO.disconnect();
    }

    function scrollY(){
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    function onOverviewScroll(){
      if (cleared || armedY === null) return;
      if (Math.abs(scrollY() - armedY) > 6) clearOverviewBlur();
    }

    function armOverviewBlur(){
      if (cleared || armedY !== null) return;
      if (armTimer) clearTimeout(armTimer);
      armTimer = setTimeout(function(){
        if (cleared) return;
        armedY = scrollY();
        window.addEventListener('scroll', onOverviewScroll, { passive: true });
      }, 120);
    }

    var visIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) armOverviewBlur();
      });
    }, { threshold: 0.18, rootMargin: '0px' });

    overviews.forEach(function(el){
      if (!el.classList.contains('is-blurred')) el.classList.add('is-blurred');
      visIO.observe(el);
    });
  }
})();
