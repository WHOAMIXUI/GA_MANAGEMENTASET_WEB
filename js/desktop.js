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
  /* avatar topbar mengikuti inisial avatar di sidebar */
  var src = document.getElementById('userAvatar'), dst = document.getElementById('dkAvatar');
  if (src && dst) {
    var sync = function () { dst.textContent = (src.textContent || 'U').trim().charAt(0) || 'U'; };
    sync();
    new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
  }
})();
