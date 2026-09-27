
(function(){
  var carousel = document.getElementById('newsCarousel');
  var viewport = document.getElementById('newsViewport');
  var track = document.getElementById('newsTrack');
  var prevBtn = document.getElementById('newsPrev');
  var nextBtn = document.getElementById('newsNext');
  var dotsWrap = document.getElementById('newsDots');
  if (!carousel || !viewport || !track || !prevBtn || !nextBtn) return;

  var slides = Array.prototype.slice.call(track.querySelectorAll('.news-slide'));
  if (!slides.length) return;

  var current = Math.floor((slides.length - 1) / 2);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var drag = { active: false, startX: 0, delta: 0, moved: false };

  slides.forEach(function(_, i){
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'news-carousel__dot' + (i === current ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Go to news slide ' + (i + 1));
    dot.addEventListener('click', function(){ goTo(i); });
    dotsWrap.appendChild(dot);
  });

  var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('.news-carousel__dot')) : [];

  function offsetFor(index){
    var slide = slides[index];
    if (!slide) return 0;
    return slide.offsetLeft + slide.offsetWidth / 2 - viewport.clientWidth / 2;
  }

  function update(){
    slides.forEach(function(slide, i){
      slide.classList.toggle('is-active', i === current);
      slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
    });
    dots.forEach(function(dot, i){
      dot.classList.toggle('is-active', i === current);
    });
    track.style.transform = 'translate3d(' + (-offsetFor(current)) + 'px,0,0)';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
  }

  function goTo(index){
    current = Math.max(0, Math.min(slides.length - 1, index));
    update();
  }

  prevBtn.addEventListener('click', function(){ goTo(current - 1); });
  nextBtn.addEventListener('click', function(){ goTo(current + 1); });

  viewport.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft'){ e.preventDefault(); goTo(current - 1); }
    if (e.key === 'ArrowRight'){ e.preventDefault(); goTo(current + 1); }
  });

  if (!reduceMotion){
    viewport.addEventListener('pointerdown', function(e){
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.active = true;
      drag.startX = e.clientX;
      drag.delta = 0;
      drag.moved = false;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointermove', function(e){
      if (!drag.active) return;
      drag.delta = e.clientX - drag.startX;
      if (Math.abs(drag.delta) > 6) drag.moved = true;
      track.style.transform = 'translate3d(' + (-offsetFor(current) + drag.delta) + 'px,0,0)';
    });

    function endDrag(e){
      if (!drag.active) return;
      drag.active = false;
      viewport.classList.remove('is-dragging');
      if (e.pointerId != null){
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      if (Math.abs(drag.delta) > 70){
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
