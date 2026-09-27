
  /* Skip-intro path: place logo in the nav immediately (no flash of empty brand) */
  (function(){
    if (document.documentElement.dataset.dhIntro !== 'skip') return;
    var intro = document.getElementById('navIntro');
    var brand = document.querySelector('.nav-inner .brand');
    if (!brand) return;
    var img = intro && intro.querySelector('.nav-intro-logo');
    if (img){
      img.classList.remove('nav-intro-logo');
      img.classList.add('brand-logo');
      img.alt = 'Digital Hub';
      brand.classList.add('has-logo');
      brand.appendChild(img);
    }
    if (intro) intro.remove();
    document.documentElement.classList.add('nav-shown');
    document.body.classList.add('nav-ready', 'loaded', 'intro-grid-reveal');
    var wipe = document.querySelector('.nav-wipe');
    if (wipe) wipe.classList.add('is-revealed');
  })();
