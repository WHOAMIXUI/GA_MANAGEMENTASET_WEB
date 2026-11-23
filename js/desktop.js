/* Tampilan DESKTOP: pencarian global di topbar + avatar. Di mobile elemen ini disembunyikan (css/desktop.css). */
(function () {
  var form = document.getElementById('dkSearchForm'), input = document.getElementById('dkSearch');
  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (typeof switchTab === 'function') switchTab('list');
      var f = document.getElementById('filterSearch');
      if (f) { f.value = q; if (typeof applyTableFilters === 'function') applyTableFilters(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') && !(e.target || {}).isContentEditable) {
        e.preventDefault(); input.focus();
      }
    });
  }
  /* avatar + menu pengguna di topbar (pindahan dari profil di dasar sidebar); data mengikuti elemen sidebar yang diisi app.js */
  var dst = document.getElementById('dkAvatar'), menu = document.getElementById('dkUserMenu');
  var pairs = [['userAvatar', 'dkAvatar', true], ['displayUserName', 'dkUserName'], ['displayUserRole', 'dkUserRole']];
  pairs.forEach(function (p) {
    var a = document.getElementById(p[0]), b = document.getElementById(p[1]);
    if (!a || !b) return;
    var sync = function () { var t = (a.textContent || '').trim(); b.textContent = p[2] ? (t.charAt(0) || 'U') : (t || b.textContent); };
    sync();
    new MutationObserver(sync).observe(a, { childList: true, characterData: true, subtree: true });
  });
  if (dst && menu) {
    window.dkCloseUserMenu = function () { menu.classList.add('hidden'); dst.setAttribute('aria-expanded', 'false'); };
    dst.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('hidden') === false;
      dst.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) window.dkCloseUserMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.dkCloseUserMenu(); });
  }
})();

/* ---------- Daftar & Status (desktop): angka di tab, teks "Menampilkan X dari Y", filter berlabel dalam satu kartu ---------- */
(function () {
  var MQ = '(min-width: 768px) and (not ((hover: none) and (pointer: coarse) and (max-width: 1100px)))';
  var mq = window.matchMedia ? window.matchMedia(MQ) : null;
  var $ = function (id) { return document.getElementById(id); };

  function sync() {
    try {
      if (typeof getAccessibleRequests !== 'function') return;
      var all = getAccessibleRequests() || [];
      document.querySelectorAll('#tkFilterTop .tk-seg button').forEach(function (b) {
        var c = b.querySelector('.dk-cnt'); if (!c) return;
        var st = b.dataset.status || '';
        c.textContent = all.filter(function (r) { return statusMatch(r.status, st); }).length;
      });
      var st = (typeof appState !== 'undefined') ? appState : null;   /* appState = const di app.js, bukan properti window */
      var sub = $('dkTblSub'), f = (st && st.pagination && st.pagination.filteredData) || [];
      if (sub) sub.innerHTML = 'Menampilkan <b>' + f.length + '</b> dari <b>' + all.length + '</b> tiket pengajuan';
    } catch (e) { /* tampilan lain tetap jalan */ }
  }
  /* bungkus fungsi app.js (deklarasi global) agar angka ikut diperbarui; perilaku aslinya tidak diubah */
  ['updateMetrics', 'renderRequestsTable'].forEach(function (n) {
    var fn = window[n]; if (typeof fn !== 'function') return;
    window[n] = function () { var r = fn.apply(this, arguments); sync(); return r; };
  });
  window.addEventListener('load', sync);

  /* ---- susun ulang kontrol filter hanya saat desktop; dikembalikan persis saat bukan desktop ---- */
  var undo = [];
  function mark(node) { var m = document.createComment('dk'); node.parentNode.insertBefore(m, node); return m; }
  function wrap(sel, text) {
    var w = document.createElement('div'); w.className = 'dk-fld';
    var l = document.createElement('span'); l.className = 'dk-lbl'; l.textContent = text;
    sel.parentNode.insertBefore(w, sel); w.appendChild(l); w.appendChild(sel);
    return w;
  }
  function enter() {
    if (undo.length) return;
    var root = $('view-list'), bot = $('tkFilterBottom'), br = $('filterBranch'), urg = $('filterUrgency');
    var exp = document.querySelector('#tkFilterRight button[onclick^="exportTicketsCSV"]');
    if (!root || !bot || !br || !urg || !exp) return;

    var mBr = mark(br), wBr = wrap(br, 'Filter Cabang'); bot.insertBefore(wBr, bot.firstChild);
    undo.push(function () { mBr.parentNode.insertBefore(br, mBr); mBr.remove(); wBr.remove(); });

    var wUr = wrap(urg, 'Tingkat Prioritas'); bot.insertBefore(wUr, wBr.nextSibling);
    undo.push(function () { wUr.parentNode.insertBefore(urg, wUr); wUr.remove(); });

    [['filterDateFrom', 'Dari Tanggal'], ['filterDateTo', 'Sampai']].forEach(function (p) {
      var inp = $(p[0]), lab = inp && inp.closest('label'); if (!lab) return;
      var tn = lab.firstChild, old = tn && tn.nodeType === 3 ? tn.nodeValue : null;
      if (old !== null) tn.nodeValue = p[1];
      undo.push(function () { if (old !== null) tn.nodeValue = old; });
    });

    var mEx = mark(exp); bot.appendChild(exp);
    undo.push(function () { mEx.parentNode.insertBefore(exp, mEx); mEx.remove(); });

    root.classList.add('dk-on'); undo.push(function () { root.classList.remove('dk-on'); });
    sync();
  }
  function leave() { while (undo.length) undo.pop()(); }
  function apply() { if (mq && mq.matches) enter(); else leave(); }
  if (mq) {
    apply();
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(apply);
  }
})();
