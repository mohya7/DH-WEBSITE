
  /* First paint: only lock the hero when this visit should play the intro */
  (function(){
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      document.documentElement.dataset.dhIntro = 'skip';
      return;
    }
    function isHomePath(pathname){
      var p = String(pathname || '/').replace(/\/index\.html$/i, '/').replace(/\/$/, '') || '/';
      return p === '/';
    }
    function shouldPlayIntro(){
      try {
        var played = sessionStorage.getItem('dh-home-intro') === '1';
        var navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        var navType = navEntry ? navEntry.type : '';
        var fromOtherPage = false;
        if (document.referrer){
          var ref = new URL(document.referrer);
          fromOtherPage = ref.origin === location.origin && !isHomePath(ref.pathname);
        }
        /* Always play when navigating to home from another site page */
        if (fromOtherPage) return true;
        /* First entry in this tab/session */
        if (!played) return true;
        /* Reload / back-forward after the intro already ran → skip */
        if (navType === 'reload' || navType === 'back_forward') return false;
        return false;
      } catch (e) {
        return true;
      }
    }
    if (shouldPlayIntro()){
      document.documentElement.dataset.dhIntro = 'play';
      document.documentElement.classList.add('intro-pending');
    } else {
      document.documentElement.dataset.dhIntro = 'skip';
    }
  })();
