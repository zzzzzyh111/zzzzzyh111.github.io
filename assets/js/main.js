/* Small progressive enhancements: theme toggle, active nav link, live GitHub star counts. */
(function () {
  var root = document.documentElement;

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

  /* ----- play thumbnail videos only while they are near the viewport ----- */
  var vids = document.querySelectorAll('.pub__thumb video');
  if ('IntersectionObserver' in window && vids.length) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          v.muted = true;
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    Array.prototype.forEach.call(vids, function (v) { vio.observe(v); });
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
        s.textContent = '★ ' + j.stargazers_count;
        a.appendChild(s);
      })
      .catch(function () {});
  });
})();
