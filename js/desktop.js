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
