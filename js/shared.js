(function(){
  'use strict';
  document.documentElement.classList.add('nav-shown');

  var nav = document.getElementById('nav');
  if (nav){
    window.addEventListener('scroll', function(){
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  var burger = document.getElementById('navBurger');
  var mNav = document.getElementById('mobileNav');
  if (burger && mNav){
    burger.addEventListener('click', function(){
      var isOpen = mNav.classList.toggle('open');
      mNav.setAttribute('aria-hidden', String(!isOpen));
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.innerHTML = isOpen ? '<i class="ti ti-x"></i>' : '<i class="ti ti-menu-2"></i>';
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    mNav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        mNav.classList.remove('open');
        document.body.style.overflow = '';
        burger.innerHTML = '<i class="ti ti-menu-2"></i>';
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('.has-dd').forEach(function(item){
    var closeTimer;
    item.addEventListener('mouseenter', function(){
      clearTimeout(closeTimer);
      if (window.matchMedia('(hover: hover)').matches) item.classList.add('is-hover');
    });
    item.addEventListener('mouseleave', function(e){
      if (!window.matchMedia('(hover: hover)').matches) return;
      if (e.relatedTarget && item.contains(e.relatedTarget)) return;
      closeTimer = setTimeout(function(){ item.classList.remove('is-hover'); }, 200);
    });
  });

  document.querySelectorAll('.has-dd > .nav-link').forEach(function(trigger){
    trigger.addEventListener('click', function(e){
      if (window.matchMedia('(hover: none)').matches){
        e.preventDefault();
        var parent = trigger.parentElement;
        document.querySelectorAll('.has-dd.open').forEach(function(o){ if (o !== parent) o.classList.remove('open'); });
        parent.classList.toggle('open');
      }
    });
  });

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(function(el){ io.observe(el); });
})();
