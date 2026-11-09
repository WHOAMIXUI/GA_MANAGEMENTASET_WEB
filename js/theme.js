/* Pemilih tema: 'dark' (tampilan awal) atau 'light' (liquid glass).
   Dimuat di <head> supaya tema terpasang sebelum halaman tergambar (tidak berkedip). */
(function () {
  var KEY = 'ga_theme', root = document.documentElement;

  function read() {
    try { var v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v; } catch (e) {}
    return 'dark';
  }
  function cssVar(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }
  function paintButtons(t) {
    var light = t === 'light';
    var label = light ? 'Ganti ke tema gelap' : 'Ganti ke tema terang (liquid glass)';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', label); b.title = label;
      var i = b.querySelector('i'); if (i) i.className = 'fa-solid ' + (light ? 'fa-moon' : 'fa-sun');
      var l = b.querySelector('.theme-toggle-label'); if (l) l.textContent = light ? 'Gelap' : 'Terang';
    });
  }
  function refreshCharts() {
    try {
      if (typeof chartInstance !== 'undefined' && chartInstance) {
        var s = chartInstance.options.scales;
        s.y.grid.color = cssVar('--chart-grid', 'rgba(255,255,255,.05)');
        s.y.ticks.color = s.x.ticks.color = cssVar('--chart-text', '#edd5b3');
        chartInstance.update();
      }
    } catch (e) {}
    try {
      var c = window.AM && window.AM.chart;
      if (c) {
        c.options.plugins.legend.labels.color = cssVar('--chart-text', '#edd5b3');
        c.data.datasets[0].borderColor = cssVar('--chart-border', '#22120a');
        c.update();
      }
    } catch (e) {}
  }
  function apply(t, changed) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = t === 'light' ? '#fdf1e3' : '#150a05';
    paintButtons(t);
    if (changed) refreshCharts();
  }

  window.themeVar = cssVar;
  window.getTheme = function () { return root.getAttribute('data-theme') || 'dark'; };
  window.setTheme = function (t) {
    if (t !== 'light' && t !== 'dark') t = 'dark';
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t, true);
  };
  window.toggleTheme = function () { window.setTheme(window.getTheme() === 'light' ? 'dark' : 'light'); };

  apply(read(), false);
  document.addEventListener('DOMContentLoaded', function () { paintButtons(window.getTheme()); });
})();
