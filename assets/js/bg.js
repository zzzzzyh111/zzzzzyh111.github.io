/* 3DGS-style point-field background. Plain 2D canvas, no libraries.
   A scanned-looking scene (floor + a few object clusters + dust) rendered as soft
   anisotropic splats, slowly orbiting, with mouse parallax and scroll drift.
   Honours prefers-reduced-motion (single static frame) and pauses when the tab is hidden. */
(function () {
  var canvas = document.getElementById('bgCanvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var N = coarse ? 340 : 760;
  var W = 0, H = 0, pts = [], sprites = [], theme = 'light';
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var scroll = window.scrollY || 0;
  var t = 0, last = 0, raf = 0, running = false;
  var trail = [];

  var PALETTES = {
    light: ['29,33,39', '14,116,144', '180,83,27'],
    dark:  ['231,233,236', '95,211,199', '240,163,107']
  };
  var BASE_ALPHA = { light: 0.62, dark: 0.85 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() {
    var u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function kind() { var r = Math.random(); return r < 0.12 ? 2 : (r < 0.55 ? 1 : 0); }

  function build() {
    pts = [];
    var i, c;
    // floor plane
    for (i = 0; i < N * 0.42; i++) {
      pts.push({ x: rand(-9, 9), y: -2.4 + gauss() * 0.1, z: rand(-7, 7), s: rand(0.6, 1.3), k: kind(), a: rand(0, Math.PI), e: rand(0.45, 1) });
    }
    // a few object-like clusters
    var C = [];
    for (i = 0; i < 5; i++) C.push({ x: rand(-6, 6), y: rand(-1.4, 0.9), z: rand(-5, 5), r: rand(0.6, 1.4) });
    for (i = 0; i < N * 0.43; i++) {
      c = C[i % C.length];
      pts.push({ x: c.x + gauss() * c.r * 0.6, y: c.y + gauss() * c.r * 0.7, z: c.z + gauss() * c.r * 0.6, s: rand(0.7, 1.6), k: kind(), a: rand(0, Math.PI), e: rand(0.35, 1) });
    }
    // sparse dust
    for (i = 0; i < N * 0.15; i++) {
      pts.push({ x: rand(-10, 10), y: rand(-3, 4), z: rand(-8, 8), s: rand(0.4, 0.9), k: 0, a: rand(0, Math.PI), e: rand(0.6, 1) });
    }
  }

  function makeSprite(rgb) {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.35, 'rgba(' + rgb + ',0.55)');
    grd.addColorStop(0.7, 'rgba(' + rgb + ',0.12)');
    grd.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return c;
  }
  function currentTheme() {
    var a = document.documentElement.getAttribute('data-theme');
    if (a === 'light' || a === 'dark') return a;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme() {
    theme = currentTheme();
    sprites = PALETTES[theme].map(makeSprite);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!running) draw(0.016);
  }

  function project(x, y, z, yaw, pitch, cam, focal, lift) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var rx = x * cy - z * sy, rz = x * sy + z * cy;
    var yy = y + lift;
    var ry = yy * cp - rz * sp; rz = yy * sp + rz * cp;
    var d = cam - rz;
    if (d < 1) return null;
    var s = focal / d;
    return { x: W / 2 + rx * s, y: H / 2 - ry * s, s: s, d: d };
  }

  function draw(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    var yaw = t * 0.045 + mouse.x * 0.28 + scroll * 0.00032;
    var pitch = -0.14 + mouse.y * 0.14;
    var cam = 11, focal = Math.max(420, Math.max(W, H) * 0.55), lift = scroll * 0.0011;
    var base = BASE_ALPHA[theme];

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = theme === 'dark' ? 'lighter' : 'source-over';

    var out = [], i, p, q;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      q = project(p.x, p.y, p.z, yaw, pitch, cam, focal, lift);
      if (!q || q.x < -40 || q.x > W + 40 || q.y < -40 || q.y > H + 40) continue;
      q.p = p;
      q.r = p.s * q.s * 0.06;
      var near = Math.min(1, (q.d - 1) / 3), far = Math.max(0.12, 1 - (q.d - 7) / 14);
      q.a = base * near * far;
      out.push(q);
    }
    out.sort(function (a, b) { return b.d - a.d; });
    for (i = 0; i < out.length; i++) {
      q = out[i]; p = q.p;
      ctx.globalAlpha = q.a;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(p.a);
      ctx.scale(1, p.e);
      ctx.drawImage(sprites[p.k], -q.r, -q.r, q.r * 2, q.r * 2);
      ctx.restore();
    }

    // a small drone threading through the scene, with a fading trail
    var dx = 5.2 * Math.sin(t * 0.31), dy = 0.35 + 0.7 * Math.sin(t * 0.47), dz = 4.2 * Math.sin(t * 0.23 + 1.3);
    trail.push([dx, dy, dz]); if (trail.length > 56) trail.shift();
    var accent = sprites[1];
    for (i = 0; i < trail.length; i++) {
      q = project(trail[i][0], trail[i][1], trail[i][2], yaw, pitch, cam, focal, lift);
      if (!q) continue;
      var f = i / trail.length;
      ctx.globalAlpha = base * f * 0.9;
      var r = (1.2 + 2.2 * f) * q.s * 0.05;
      ctx.drawImage(accent, q.x - r, q.y - r, r * 2, r * 2);
    }
    q = project(dx, dy, dz, yaw, pitch, cam, focal, lift);
    if (q) {
      ctx.globalAlpha = Math.min(1, base + 0.3);
      var hr = 4.5 * q.s * 0.05;
      ctx.drawImage(accent, q.x - hr * 2.2, q.y - hr * 2.2, hr * 4.4, hr * 4.4);
      ctx.drawImage(accent, q.x - hr, q.y - hr, hr * 2, hr * 2);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduceMQ.matches) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', function () { scroll = window.scrollY || 0; }, { passive: true });
  if (!coarse) {
    window.addEventListener('pointermove', function (e) {
      mouse.tx = e.clientX / W - 0.5; mouse.ty = e.clientY / H - 0.5;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  var mo = new MutationObserver(function () { applyTheme(); if (!running) draw(0); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { applyTheme(); if (!running) draw(0); });
  reduceMQ.addEventListener('change', function () { if (reduceMQ.matches) { stop(); draw(0); } else start(); });

  build();
  applyTheme();
  resize();
  if (reduceMQ.matches) draw(0); else start();
})();
