/* PWA: pendaftaran service worker, tombol pasang aplikasi, banner offline, notifikasi versi baru. */
(() => {
  const W = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const P = window.PWA = { deferred: null };

  // --- banner offline ---
  function bar() {
    let b = document.getElementById('pwaOffline');
    if (!b) {
      b = document.createElement('div');
      b.id = 'pwaOffline';
      b.className = 'ga-offline-bar hidden';
      b.innerHTML = '<i class="fa-solid fa-circle-info"></i> Tidak ada koneksi. Perubahan disimpan di perangkat dan dikirim otomatis saat online.';
      document.body.appendChild(b);
    }
    return b;
  }
  const syncBar = () => bar().classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', syncBar);
  window.addEventListener('offline', syncBar);
  window.addEventListener('DOMContentLoaded', syncBar);

  // --- service worker ---
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        P.reg = reg;
        const offerUpdate = w => {
          if (!w || !navigator.serviceWorker.controller) return;
          try {
            Swal.fire({ toast: true, position: 'bottom', icon: 'info', title: 'Versi baru tersedia', showConfirmButton: true, confirmButtonText: 'Muat ulang', showCloseButton: true, ...W })
              .then(r => { if (r.isConfirmed) { w.postMessage('SKIP_WAITING'); } });
          } catch (_) {}
        };
        if (reg.waiting) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offerUpdate(w); });
        });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
        setInterval(() => reg.update().catch(() => {}), 3600000);
      } catch (e) { console.warn('Service worker gagal didaftarkan:', e); }
    });
  }

  // --- pasang aplikasi ---
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); P.deferred = e; });
  window.addEventListener('appinstalled', () => { P.deferred = null; });
  P.install = async () => {
    if (!P.deferred) return false;
    P.deferred.prompt();
    const r = await P.deferred.userChoice.catch(() => ({}));
    P.deferred = null;
    return r.outcome === 'accepted';
  };
  // Tawarkan sekali setelah login (ditunda 14 hari bila ditutup).
  const KEY = 'ga_pwa_hint';
  P.offer = async () => {
    if (isStandalone()) return;
    const until = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() < until) return;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!P.deferred && !ios) return;
    const r = await Swal.fire({
      title: 'Pasang aplikasi di HP?',
      html: ios ? 'Ketuk tombol <b>Bagikan</b>, lalu pilih <b>Tambah ke Layar Utama</b>. Aplikasi terbuka layar penuh dan tetap bisa dibuka saat sinyal lemah.'
                : 'Aplikasi tampil layar penuh, muncul di layar utama, dan tetap bisa dibuka saat sinyal lemah.',
      icon: 'info', showCancelButton: true, confirmButtonText: ios ? 'Mengerti' : 'Pasang', cancelButtonText: 'Nanti', ...W
    });
    if (r.isConfirmed && !ios) await P.install();
    else localStorage.setItem(KEY, String(Date.now() + 14 * 864e5));
  };
  window.addEventListener('profile-ready', () => setTimeout(() => P.offer().catch(() => {}), 6000));
})();
