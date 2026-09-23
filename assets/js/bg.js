/* 3DGS-style point-field background. Plain 2D canvas, no libraries.
   A scanned-looking scene (floor + object clusters + dust) rendered as soft anisotropic
   splats, slowly orbiting, with mouse parallax and scroll drift, plus a small squad of
   drones flying through it. The centre column is masked out in CSS so the field only
   shows in the side margins; below 1000px there are no margins and it is switched off.
   Honours prefers-reduced-motion (single static frame) and pauses when the tab is hidden. */
(function () {
  var canvas = document.getElementById('bgCanvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var MIN_REM = 62.5;                 // matches the CSS breakpoint, so it tracks the reader's font size
  var N = 760;
  var W = 0, H = 0, pts = [], sprites = [], droneSprite = null, theme = 'light';
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var scroll = window.scrollY || 0;
  var t = 0, last = 0, raf = 0, running = false, enabled = true;
  var drones = [];

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
    for (i = 0; i < N * 0.42; i++) {                       // floor plane
      pts.push({ x: rand(-10, 10), y: -2.4 + gauss() * 0.1, z: rand(-7, 7), s: rand(0.6, 1.3), k: kind(), a: rand(0, Math.PI), e: rand(0.45, 1) });
    }
    var C = [];                                             // object-like clusters
    for (i = 0; i < 6; i++) C.push({ x: rand(-7, 7), y: rand(-1.4, 0.9), z: rand(-5, 5), r: rand(0.6, 1.4) });
    for (i = 0; i < N * 0.43; i++) {
      c = C[i % C.length];
      pts.push({ x: c.x + gauss() * c.r * 0.6, y: c.y + gauss() * c.r * 0.7, z: c.z + gauss() * c.r * 0.6, s: rand(0.7, 1.6), k: kind(), a: rand(0, Math.PI), e: rand(0.35, 1) });
    }
    for (i = 0; i < N * 0.15; i++) {                       // sparse dust
      pts.push({ x: rand(-11, 11), y: rand(-3, 4), z: rand(-8, 8), s: rand(0.4, 0.9), k: 0, a: rand(0, Math.PI), e: rand(0.6, 1) });
    }
    drones = [];
    for (i = 0; i < 6; i++) {
      drones.push({
        ax: rand(4.5, 7.5), ay: rand(0.4, 1.1), az: rand(3, 5.5), oy: rand(-0.6, 1.2),
        fx: rand(0.14, 0.3), fy: rand(0.25, 0.5), fz: rand(0.12, 0.26),
        px: rand(0, 6.28), py: rand(0, 6.28), pz: rand(0, 6.28), trail: []
      });
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
  /* top-down quadrotor: X arms, four rotor rings, body, nose dot (nose points up) */
  function makeDroneSprite(rgb) {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), m = S / 2;
    var grd = g.createRadialGradient(m, m, 0, m, m, m);
    grd.addColorStop(0, 'rgba(' + rgb + ',0.32)'); grd.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(' + rgb + ',1)'; g.fillStyle = 'rgba(' + rgb + ',1)';
    g.lineCap = 'round'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(m - 13, m - 13); g.lineTo(m + 13, m + 13); g.moveTo(m + 13, m - 13); g.lineTo(m - 13, m + 13); g.stroke();
    g.lineWidth = 2.6;
    [[m - 16, m - 16], [m + 16, m - 16], [m - 16, m + 16], [m + 16, m + 16]].forEach(function (p) {
      g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.stroke();
    });
    g.beginPath(); g.arc(m, m, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(m, m - 9, 2.4, 0, Math.PI * 2); g.fill();
    return c;
  }
  function currentTheme() {
    var a = document.documentElement.getAttribute('data-theme');
    return a === 'dark' ? 'dark' : 'light';   // light everywhere unless the reader picks dark
  }
  function applyTheme() {
    theme = currentTheme();
    sprites = PALETTES[theme].map(makeSprite);
    droneSprite = makeDroneSprite(PALETTES[theme][1]);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    enabled = W >= MIN_REM * rem;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!enabled) { stop(); ctx.clearRect(0, 0, W, H); return; }
    if (!running) { if (reduceMQ.matches) draw(0); else start(); }
  }

  function project(x, y, z, cam) {
    var rx = x * cam.cy - z * cam.sy, rz = x * cam.sy + z * cam.cy;
    var yy = y + cam.lift;
    var ry = yy * cam.cp - rz * cam.sp; rz = yy * cam.sp + rz * cam.cp;
    var d = cam.dist - rz;
    if (d < 1) return null;
    var s = cam.focal / d;
    return { x: W / 2 + rx * s, y: H / 2 - ry * s, s: s, d: d };
  }
  function dronePos(dr, tt) {
    return [dr.ax * Math.sin(dr.fx * tt + dr.px), dr.oy + dr.ay * Math.sin(dr.fy * tt + dr.py), dr.az * Math.sin(dr.fz * tt + dr.pz)];
  }

  function draw(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    var yaw = t * 0.04 + mouse.x * 0.28 + scroll * 0.0003;
    var pitch = -0.14 + mouse.y * 0.14;
    var cam = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch),
                dist: 11, focal: Math.max(420, Math.max(W, H) * 0.55), lift: scroll * 0.0011 };
    var base = BASE_ALPHA[theme];

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = theme === 'dark' ? 'lighter' : 'source-over';

    var out = [], i, j, p, q;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      q = project(p.x, p.y, p.z, cam);
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

    // drones: fading trail of small splats, then the quadrotor sprite turned to its heading
    var accent = sprites[1];
    for (j = 0; j < drones.length; j++) {
      var dr = drones[j], pos = dronePos(dr, t), ahead = dronePos(dr, t + 0.12);
      dr.trail.push(pos); if (dr.trail.length > 40) dr.trail.shift();
      for (i = 0; i < dr.trail.length; i++) {
        q = project(dr.trail[i][0], dr.trail[i][1], dr.trail[i][2], cam);
        if (!q) continue;
        var f = i / dr.trail.length;
        ctx.globalAlpha = base * f * 0.55;
        var r = (0.4 + 1.2 * f) * q.s * 0.06;
        ctx.drawImage(accent, q.x - r, q.y - r, r * 2, r * 2);
      }
      q = project(pos[0], pos[1], pos[2], cam);
      var q2 = project(ahead[0], ahead[1], ahead[2], cam);
      if (!q || !q2) continue;
      var heading = Math.atan2(q2.y - q.y, q2.x - q.x) + Math.PI / 2;
      var half = Math.min(26, Math.max(8, 0.26 * q.s));
      ctx.globalAlpha = Math.min(1, base + 0.25) * Math.min(1, (q.d - 1) / 3);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(heading);
      ctx.drawImage(droneSprite, -half, -half, half * 2, half * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !enabled || reduceMQ.matches) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', function () { scroll = window.scrollY || 0; }, { passive: true });
  if (!coarse) {
    window.addEventListener('pointermove', function (e) {
      mouse.tx = e.clientX / W - 0.5; mouse.ty = e.clientY / H - 0.5;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  var mo = new MutationObserver(function () { applyTheme(); if (!running && enabled) draw(0); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduceMQ.addEventListener('change', function () { if (reduceMQ.matches) { stop(); if (enabled) draw(0); } else start(); });

  build();
  applyTheme();
  resize();
})();
