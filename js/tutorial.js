/* Video tutorial pengajuan: buka/tutup pemutar. Video baru dimuat saat dibuka (preload="none") agar hemat kuota. */
(function () {
  var modal, video, closeBtn, opener = null;
  function els() { modal = modal || document.getElementById('tutorialModal'); video = video || document.getElementById('tutVideo'); closeBtn = closeBtn || document.getElementById('tutClose'); return !!(modal && video); }
  window.openTutorial = function () {
    if (!els()) return;
    opener = document.activeElement;
    modal.hidden = false; document.body.style.overflow = 'hidden';
    var p = video.play(); if (p && p.catch) p.catch(function () { /* browser menolak autoplay: pengguna tinggal menekan play */ });
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  };
  window.closeTutorial = function () {
    if (!els() || modal.hidden) return;
    video.pause(); modal.hidden = true; document.body.style.overflow = '';
    if (opener && opener.focus) try { opener.focus({ preventScroll: true }); } catch (e) {}
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.closeTutorial(); });
})();
