/**
 * Hero sand grains + GPU cursor smoke.
 * Fluid uses the MIT webgl-fluid solver (same family BaseOne documents),
 * tuned from BaseOne's published config and Digital Hub blue.
 * System cursor is never replaced.
 */
import WebGLFluid from "./webgl-fluid-lib.js?v=26";

(function () {
  var hero = document.getElementById("top");
  var fluidCanvas = document.getElementById("heroFluidCanvas");
  var sandCanvas = document.getElementById("heroSandCanvas");
  if (!hero || !fluidCanvas) return;

  window.__heroGridRevealInstant = function () {
    document.body.classList.add("intro-grid-reveal");
  };
  window.__heroGridReveal = function (onDone) {
    document.body.classList.add("intro-grid-reveal");
    if (onDone) onDone();
  };

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Sand grains                                                        */
  /* ------------------------------------------------------------------ */
  var sandCtx = sandCanvas ? sandCanvas.getContext("2d") : null;
  var particles = [];
  var sandW = 0;
  var sandH = 0;
  var sandDpr = 1;
  var DENSITY = 0.00028;
  var MIN_PARTICLES = 180;
  var MAX_PARTICLES = 420;
  var FLOW_RADIUS = 180;
  var COLORS = [
    [54, 176, 229],
    [91, 194, 240],
    [244, 151, 11],
    [251, 184, 81]
  ];
  var sandPointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, active: false };
  var lastSand = performance.now();

  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function particleAt() {
    var color = COLORS[(Math.random() * COLORS.length) | 0];
    return {
      x: Math.random() * sandW,
      y: Math.random() * sandH,
      vx: randomBetween(-0.1, 0.1),
      vy: randomBetween(-0.05, 0.05),
      size: randomBetween(0.7, 2),
      alpha: randomBetween(0.22, 0.58),
      color: color,
      phase: Math.random() * Math.PI * 2
    };
  }

  function resizeSand() {
    if (!sandCtx) return;
    var rect = hero.getBoundingClientRect();
    sandDpr = Math.min(window.devicePixelRatio || 1, 2);
    sandW = rect.width;
    sandH = rect.height;
    sandCanvas.width = Math.max(1, Math.round(sandW * sandDpr));
    sandCanvas.height = Math.max(1, Math.round(sandH * sandDpr));
    sandCanvas.style.width = sandW + "px";
    sandCanvas.style.height = sandH + "px";
    sandCtx.setTransform(sandDpr, 0, 0, sandDpr, 0, 0);
    var count = Math.max(
      MIN_PARTICLES,
      Math.min(MAX_PARTICLES, Math.round(sandW * sandH * DENSITY))
    );
    while (particles.length < count) particles.push(particleAt());
    if (particles.length > count) particles.length = count;
  }

  function frameSand(now) {
    if (!sandCtx) return;
    var dt = Math.min(2.2, Math.max(0.35, ((now - lastSand) / 1000) * 60));
    lastSand = now;
    sandCtx.clearRect(0, 0, sandW, sandH);
    sandCtx.globalCompositeOperation = "lighter";

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.vx += Math.sin(now * 0.00045 + p.phase) * 0.0018 * dt;
      p.vy += Math.cos(now * 0.00033 + p.phase) * 0.001 * dt;

      if (sandPointer.active) {
        var dx = p.x - sandPointer.x;
        var dy = p.y - sandPointer.y;
        var d2 = dx * dx + dy * dy;
        var r2 = FLOW_RADIUS * FLOW_RADIUS;
        if (d2 < r2 && d2 > 1) {
          var d = Math.sqrt(d2);
          var fall = 1 - d / FLOW_RADIUS;
          fall *= fall;
          var cur = Math.min(
            1.5,
            Math.sqrt(sandPointer.vx * sandPointer.vx + sandPointer.vy * sandPointer.vy)
          );
          p.vx += (dx / d) * fall * (0.04 + cur * 0.12) * dt;
          p.vy += (dy / d) * fall * (0.04 + cur * 0.12) * dt;
          p.vx += sandPointer.vx * fall * 0.025 * dt;
          p.vy += sandPointer.vy * fall * 0.025 * dt;
        }
      }

      p.vx *= Math.pow(0.965, dt);
      p.vy *= Math.pow(0.965, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -12) p.x = sandW + 12;
      if (p.x > sandW + 12) p.x = -12;
      if (p.y < -12) p.y = sandH + 12;
      if (p.y > sandH + 12) p.y = -12;

      var shimmer = 0.7 + Math.sin(now * 0.002 + p.phase) * 0.3;
      sandCtx.fillStyle =
        "rgba(" +
        p.color[0] +
        "," +
        p.color[1] +
        "," +
        p.color[2] +
        "," +
        p.alpha * shimmer +
        ")";
      sandCtx.beginPath();
      sandCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      sandCtx.fill();
    }
    sandCtx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frameSand);
  }

  hero.addEventListener(
    "pointermove",
    function (event) {
      var rect = hero.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      sandPointer.vx = sandPointer.active ? x - sandPointer.x : 0;
      sandPointer.vy = sandPointer.active ? y - sandPointer.y : 0;
      sandPointer.x = x;
      sandPointer.y = y;
      sandPointer.active = true;
    },
    { passive: true }
  );
  hero.addEventListener("pointerleave", function () {
    sandPointer.active = false;
  });

  window.addEventListener("resize", resizeSand);
  resizeSand();
  requestAnimationFrame(frameSand);

  /* ------------------------------------------------------------------ */
  /* GPU fluid — MIT webgl-fluid, BaseOne-published tuning              */
  /* ------------------------------------------------------------------ */
  // BaseOne: transparent smoke ≈ section accent × 0.15
  var smoke = {
    r: (54 / 255) * 0.15,
    g: (176 / 255) * 0.15,
    b: (229 / 255) * 0.15
  };

  // Config mirrored from BaseOne's published CFG (baseone.uk):
  // SIM 160 / DYE 512 · density .975 · velocity .9 · pressure .55/18 · curl 0
  // Their SPLAT_RADIUS 0.0032 ≡ MIT lib value 0.32 (lib divides by 100).
  // Their SPLAT_FORCE 5 with *1000 pointer scale ≈ MIT force ~5000.
  WebGLFluid(fluidCanvas, {
    TRIGGER: "hover",
    IMMEDIATE: true,
    AUTO: false,
    INPUT_TARGET: hero,
    SIM_RESOLUTION: 160,
    DYE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 0.975,
    VELOCITY_DISSIPATION: 0.9,
    PRESSURE: 0.55,
    PRESSURE_ITERATIONS: 18,
    CURL: 0,
    SPLAT_RADIUS: 0.14,
    SPLAT_FORCE: 2800,
    SHADING: false,
    COLORFUL: false,
    PAUSED: false,
    TRANSPARENT: true,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    BLOOM: false,
    SUNRAYS: false,
    SPLAT_COLOR: smoke
  });

  window.__heroFluidOk = true;
})();
