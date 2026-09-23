/* Drone point clouds. Plain 2D canvas, no libraries.
   Each drone is a small 3DGS-style point cloud (~260 soft splats) sampled from a quadrotor
   model: body, four arms, four spinning rotor discs, a nose camera and two LEDs. Drones fly
   in the side margins (the centre column is masked out in CSS), banking into turns, over a
   sparse dust field for depth. Mouse parallax and scroll drift are subtle. Off below 1000px.
   Honours prefers-reduced-motion (single static frame) and pauses when the tab is hidden. */
(function () {
  var canvas = document.getElementById('bgCanvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var MIN_WIDTH = 1000, DRONES = 6, DUST = 170, CAM = 11;
  var W = 0, H = 0, focal = 700, sprites = [], theme = 'light';
  var band = 300, bandScale = 1;                       // visible margin width (px) and drone size factor
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var scroll = window.scrollY || 0;
  var t = 0, last = 0, raf = 0, running = false, enabled = true;
  var model = [], drones = [], dust = [];

  var PALETTES = {
    light: ['29,33,39', '14,116,144', '180,83,27'],
    dark:  ['231,233,236', '95,211,199', '240,163,107']
  };
  var BASE_ALPHA = { light: 0.72, dark: 0.9 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() {
    var u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---- quadrotor model in local units (forward = +z, up = +y), radius ~1 ---- */
  function buildModel() {
    var pts = [], i, j, f;
    var bx = 0.26, by = 0.11, bz = 0.36;
    for (i = 0; i < 64; i++) {                                   // body shell
      var face = i % 6, u = rand(-1, 1), v = rand(-1, 1), p;
      if (face === 0) p = [bx, u * by, v * bz]; else if (face === 1) p = [-bx, u * by, v * bz];
      else if (face === 2) p = [u * bx, by, v * bz]; else if (face === 3) p = [u * bx, -by, v * bz];
      else if (face === 4) p = [u * bx, v * by, bz]; else p = [u * bx, v * by, -bz];
      pts.push({ x: p[0], y: p[1], z: p[2], k: 0, s: rand(0.7, 1.1), e: rand(0.6, 1), a: rand(0, Math.PI), rot: -1 });
    }
    var corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (j = 0; j < 4; j++) {                                    // arms
      for (i = 0; i < 14; i++) {
        f = (i + 0.5) / 14;
        pts.push({ x: corners[j][0] * (0.22 + 0.68 * f), y: 0.02, z: corners[j][1] * (0.22 + 0.68 * f), k: 0, s: rand(0.55, 0.85), e: rand(0.5, 0.9), a: rand(0, Math.PI), rot: -1 });
      }
      var cx = corners[j][0] * 0.9, cz = corners[j][1] * 0.9;     // rotor ring + hub
      for (i = 0; i < 24; i++) pts.push({ x: cx, y: 0.09, z: cz, r: 0.42, ang: i / 24 * Math.PI * 2, k: 1, s: rand(0.55, 0.8), e: 0.32, a: 0, rot: j });
      for (i = 0; i < 6; i++) pts.push({ x: cx + gauss() * 0.03, y: 0.12, z: cz + gauss() * 0.03, k: 0, s: 0.8, e: 0.8, a: rand(0, Math.PI), rot: -1 });
    }
    for (i = 0; i < 10; i++) pts.push({ x: gauss() * 0.05, y: -0.17 + gauss() * 0.03, z: 0.34 + gauss() * 0.04, k: 1, s: 0.9, e: 0.9, a: rand(0, Math.PI), rot: -1 }); // nose camera
    pts.push({ x: 0.2, y: 0, z: 0.39, k: 2, s: 1.25, e: 1, a: 0, rot: -1 });           // LEDs
    pts.push({ x: -0.2, y: 0, z: 0.39, k: 2, s: 1.25, e: 1, a: 0, rot: -1 });
    for (j = 0; j < 2; j++) for (i = 0; i < 6; i++) {            // legs
      f = (i + 0.5) / 6;
      pts.push({ x: j ? 0.18 : -0.18, y: -0.12 - 0.2 * f, z: 0, k: 0, s: 0.55, e: 0.6, a: Math.PI / 2, rot: -1 });
    }
    return pts;
  }

  function build() {
    model = buildModel();
    drones = [];
    for (var i = 0; i < DRONES; i++) {
      drones.push({
        side: i % 2 ? 1 : -1,
        oy: -3.4 + (Math.floor(i / 2) + rand(0.2, 0.8)) * 2.3,
        ay: rand(0.5, 0.9), fy: rand(0.18, 0.32), py: rand(0, 6.28),
        wob: rand(60, 110), fx: rand(0.1, 0.2), px: rand(0, 6.28),
        az: rand(1.2, 1.8), fz: rand(0.08, 0.16), pz: rand(0, 6.28),
        scale: rand(0.62, 0.82), spin: rand(0, 6.28), yaw: 0, roll: 0
      });
    }
    dust = [];
    for (i = 0; i < DUST; i++) dust.push({ x: rand(-14, 14), y: rand(-4, 4), z: rand(-7, 6), s: rand(0.35, 0.8), k: Math.random() < 0.7 ? 0 : 1, e: rand(0.6, 1), a: rand(0, Math.PI) });
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
  function applyTheme() { theme = currentTheme(); sprites = PALETTES[theme].map(makeSprite); }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    focal = Math.max(420, Math.max(W, H) * 0.55);
    band = Math.max(60, W / 2 - 500);
    bandScale = clamp(band / 230, 0.55, 1);
    enabled = W >= MIN_WIDTH;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!enabled) { stop(); ctx.clearRect(0, 0, W, H); return; }
    if (!running) { if (reduceMQ.matches) draw(0); else start(); }
  }

  /* world -> screen with a little camera parallax */
  function project(x, y, z, cam) {
    var rx = x * cam.cy - z * cam.sy, rz = x * cam.sy + z * cam.cy;
    var yy = y + cam.lift;
    var ry = yy * cam.cp - rz * cam.sp; rz = yy * cam.sp + rz * cam.cp;
    var d = CAM - rz;
    if (d < 1) return null;
    var s = focal / d;
    return { x: W / 2 + rx * s, y: H / 2 - ry * s, s: s, d: d };
  }
  /* drone path: kept centred in the side margin band whatever the viewport width */
  function dronePos(dr, tt) {
    var z = dr.az * Math.sin(dr.fz * tt + dr.pz);
    var d = CAM - z;
    var px = (W / 2 - band / 2 + dr.wob * bandScale * Math.sin(dr.fx * tt + dr.px)) * d / focal;
    var y = dr.oy + dr.ay * Math.sin(dr.fy * tt + dr.py) + 0.05 * Math.sin(3.1 * tt + dr.py);
    return [dr.side * px, y, z];
  }

  function draw(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    var yaw = mouse.x * 0.16 + scroll * 0.00012, pitch = -0.08 + mouse.y * 0.1;
    var cam = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), lift: scroll * 0.0009 };
    var base = BASE_ALPHA[theme];
    var out = [], i, j, q, p;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = theme === 'dark' ? 'lighter' : 'source-over';

    for (i = 0; i < dust.length; i++) {                          // dust
      p = dust[i];
      q = project(p.x, p.y, p.z, cam);
      if (!q) continue;
      q.r = p.s * q.s * 0.05; q.k = p.k; q.e = p.e; q.a = p.a;
      q.al = base * 0.55 * Math.max(0.15, 1 - (q.d - 7) / 14);
      out.push(q);
    }

    for (j = 0; j < drones.length; j++) {                        // drones
      var dr = drones[j];
      var pos = dronePos(dr, t), ahead = dronePos(dr, t + 0.15);
      var vx = ahead[0] - pos[0], vz = ahead[2] - pos[2];
      var targetYaw = Math.atan2(vx, vz);
      var dyaw = targetYaw - dr.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      dr.yaw += dyaw * Math.min(1, dt * 3);
      var targetRoll = clamp(-dyaw * 4, -0.5, 0.5);
      dr.roll += (targetRoll - dr.roll) * Math.min(1, dt * 2.5);
      var pitchL = -0.14;
      var cr = Math.cos(dr.roll), sr = Math.sin(dr.roll), cp = Math.cos(pitchL), sp = Math.sin(pitchL), cy = Math.cos(dr.yaw), sy = Math.sin(dr.yaw);
      dr.spin += dt * 13;

      for (i = 0; i < model.length; i++) {
        p = model[i];
        var lx = p.x, ly = p.y, lz = p.z, tangent = null;
        if (p.rot >= 0) {                                        // spinning rotor ring point
          var dir = (p.rot === 0 || p.rot === 3) ? 1 : -1;
          var ang = p.ang + dr.spin * dir;
          lx = p.x + p.r * Math.cos(ang); lz = p.z + p.r * Math.sin(ang);
          tangent = [p.x + p.r * Math.cos(ang + 0.25 * dir), p.y, p.z + p.r * Math.sin(ang + 0.25 * dir)];
        }
        q = toScreen(lx, ly, lz);
        if (!q) continue;
        q.r = p.s * q.s * 0.055 * dr.scale * bandScale * 1.15;
        q.k = p.k; q.e = p.e;
        if (tangent) {
          var q2 = toScreen(tangent[0], tangent[1], tangent[2]);
          q.a = q2 ? Math.atan2(q2.y - q.y, q2.x - q.x) : 0;
        } else { q.a = p.a; }
        q.al = base * Math.min(1, (q.d - 1) / 3) * (p.k === 2 ? 1.1 : 1);
        out.push(q);
      }
      function toScreen(lx, ly, lz) {                            // local -> world -> screen
        var x = lx * cr - ly * sr, y = lx * sr + ly * cr, z = lz;
        var y2 = y * cp - z * sp, z2 = y * sp + z * cp; y = y2; z = z2;
        var x3 = x * cy + z * sy, z3 = -x * sy + z * cy;
        var sc = dr.scale * bandScale;
        return project(pos[0] + x3 * sc, pos[1] + y * sc, pos[2] + z3 * sc, cam);
      }
    }

    out.sort(function (a, b) { return b.d - a.d; });
    for (i = 0; i < out.length; i++) {
      q = out[i];
      ctx.globalAlpha = Math.min(1, q.al);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.a);
      ctx.scale(1, q.e);
      ctx.drawImage(sprites[q.k], -q.r, -q.r, q.r * 2, q.r * 2);
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
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { applyTheme(); if (!running && enabled) draw(0); });
  reduceMQ.addEventListener('change', function () { if (reduceMQ.matches) { stop(); if (enabled) draw(0); } else start(); });

  build();
  applyTheme();
  resize();
})();
