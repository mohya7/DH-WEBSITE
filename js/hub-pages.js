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
})();
