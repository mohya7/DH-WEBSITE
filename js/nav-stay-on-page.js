(function(){
  'use strict';

  function normPath(pathname){
    var p = (pathname || '').replace(/\\/g, '/');
    if (p.endsWith('/index.html')) p = p.slice(0, -11);
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p.toLowerCase();
  }

  function isSameDestination(href){
    if (!href || href === '#' || href === './' || href === '.') return true;
    try{
      var target = new URL(href, window.location.href);
      var current = new URL(window.location.href);
      return normPath(target.pathname) === normPath(current.pathname);
    }catch(_){
      return false;
    }
  }

  function bindStayOnPage(link){
    if (!link || link.dataset.stayOnPageBound) return;
    link.dataset.stayOnPageBound = '1';
    link.addEventListener('click', function(e){
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (link.classList.contains('is-active') && isSameDestination(href)){
        e.preventDefault();
      }
    });
  }

  document.querySelectorAll('.nav-link.is-active[href], .dd a.is-active[href]').forEach(bindStayOnPage);
  document.querySelectorAll('.mobile-nav a[href]').forEach(function(link){
    var href = link.getAttribute('href');
    if (!href) return;
    try{
      var current = normPath(window.location.pathname);
      var target = normPath(new URL(href, window.location.href).pathname);
      if (current === target) bindStayOnPage(link);
    }catch(_){}
  });
})();
