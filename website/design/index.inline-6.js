
(function(){
  var carousel = document.getElementById('blogsCarousel');
  var viewport = document.getElementById('blogsViewport');
  var track = document.getElementById('blogsTrack');
  var prevBtn = document.getElementById('blogsPrev');
  var nextBtn = document.getElementById('blogsNext');
  if (!carousel || !viewport || !track || !prevBtn || !nextBtn) return;

  var cards = Array.prototype.slice.call(track.querySelectorAll('.blog-dest'));
  if (!cards.length) return;

  var current = 0;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var drag = { active: false, startX: 0, delta: 0 };

  function step(){
    var card = cards[0];
    if (!card) return 0;
    return card.offsetWidth + 16;
  }

  function maxIndex(){
    var viewW = viewport.clientWidth;
    var totalW = track.scrollWidth;
    if (totalW <= viewW) return 0;
    var maxOffset = totalW - viewW;
    return Math.ceil(maxOffset / step());
  }

  function update(){
    var offset = current * step();
    var maxOff = Math.max(0, track.scrollWidth - viewport.clientWidth);
    offset = Math.min(offset, maxOff);
    track.style.transform = 'translate3d(' + (-offset) + 'px,0,0)';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current >= maxIndex();
    viewport.classList.toggle('is-scrolled', current > 0);
  }

  function goTo(index){
    current = Math.max(0, Math.min(maxIndex(), index));
    update();
  }

  prevBtn.addEventListener('click', function(){ goTo(current - 1); });
  nextBtn.addEventListener('click', function(){ goTo(current + 1); });

  if (!reduceMotion){
    viewport.addEventListener('pointerdown', function(e){
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.active = true;
      drag.startX = e.clientX;
      drag.delta = 0;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', function(e){
      if (!drag.active) return;
      drag.delta = e.clientX - drag.startX;
      var base = current * step();
      var maxOff = Math.max(0, track.scrollWidth - viewport.clientWidth);
      var off = Math.max(0, Math.min(maxOff, base - drag.delta));
      track.style.transform = 'translate3d(' + (-off) + 'px,0,0)';
      viewport.classList.toggle('is-scrolled', off > 0);
    });
    function endDrag(e){
      if (!drag.active) return;
      drag.active = false;
      viewport.classList.remove('is-dragging');
      try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      if (Math.abs(drag.delta) > 50){
        goTo(current + (drag.delta < 0 ? 1 : -1));
      } else {
        update();
      }
      drag.delta = 0;
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
  }

  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  update();
})();
