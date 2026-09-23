/* Small progressive enhancements: theme toggle, active nav link, live GitHub star counts. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ----- theme toggle ----- */
  var btn = document.getElementById('themeToggle');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (!reduce) { root.classList.add('theme-anim'); setTimeout(function () { root.classList.remove('theme-anim'); }, 400); }
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ----- highlight the nav link of the section in view ----- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
  var byId = {};
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    if (document.getElementById(id)) byId[id] = a;
  });
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var a = byId[entry.target.id];
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ----- back-to-top button ----- */
  var toTop = document.getElementById('toTop');
  if (toTop) {
    var toTopTick = false;
    function updateToTop() { toTop.classList.toggle('is-visible', window.scrollY > 480); toTopTick = false; }
    window.addEventListener('scroll', function () { if (!toTopTick) { toTopTick = true; requestAnimationFrame(updateToTop); } }, { passive: true });
    updateToTop();
    toTop.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ----- scroll reveal ----- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        ro.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(revealEls, function (el) { ro.observe(el); });
  } else {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('is-in'); });
  }
  // safety net: never leave content hidden if an observer callback is missed
  setTimeout(function () { Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('is-in'); }); }, 3000);

  /* ----- publication cards: video plays on hover (desktop) or in view (touch) ----- */
  var cards = document.querySelectorAll('.pub');
  Array.prototype.forEach.call(cards, function (card) {
    var v = card.querySelector('video');
    if (hoverable) {
      card.addEventListener('pointerenter', function () {
        if (v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      card.addEventListener('pointerleave', function () {
        if (v) { v.pause(); try { v.currentTime = 0; } catch (err) {} }
      });
    }
  });
  if (!hoverable) {
    var vids = document.querySelectorAll('.pub__thumb video');
    if ('IntersectionObserver' in window && vids.length) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { v.pause(); }
        });
      }, { rootMargin: '200px 0px' });
      Array.prototype.forEach.call(vids, function (v) { vio.observe(v); });
    }
  }

  /* ----- live star counts on "Code" links (fails silently, e.g. when rate-limited) ----- */
  var codeLinks = document.querySelectorAll('a[data-repo]');
  Array.prototype.forEach.call(codeLinks, function (a) {
    var repo = a.getAttribute('data-repo');
    if (!repo || typeof fetch !== 'function') return;
    fetch('https://api.github.com/repos/' + repo, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        if (typeof j.stargazers_count !== 'number') return;
        var s = document.createElement('span');
        s.className = 'stars';
        a.appendChild(s);
        var n = j.stargazers_count;
        if (reduce || !window.requestAnimationFrame) { s.textContent = '★ ' + n; return; }
        var t0 = null;
        (function step(now) {
          if (t0 === null) t0 = now;
          var k = Math.min(1, (now - t0) / 900); k = 1 - Math.pow(1 - k, 3);
          s.textContent = '★ ' + Math.round(n * k);
          if (k < 1) requestAnimationFrame(step);
        })(performance.now());
      })
      .catch(function () {});
  });
})();
