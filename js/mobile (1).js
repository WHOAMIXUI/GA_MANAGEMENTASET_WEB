/* Tampilan mobile: bottom navigation, lembar "Menu", dan label kartu untuk tabel.
   Dimuat paling akhir. Hanya berpengaruh di layar <= 767px (lihat css/mobile.css); di desktop semuanya tersembunyi. */
(() => {
  const mq = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse) and (max-width: 1100px)');
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 5 tombol bawah. "Menu" membuka lembar berisi seluruh menu lainnya.
  const ITEMS = [
    { tab: 'form',  icon: 'fa-pen-to-square', label: 'Buat' },
    { tab: 'list',  icon: 'fa-list-check',    label: 'Tiket', badge: true },
    { tab: 'areg',  icon: 'fa-boxes-stacked', label: 'Aset' },
    { tab: 'adash', icon: 'fa-chart-pie',     label: 'Dashboard' },
    { tab: '__menu', icon: 'fa-bars',         label: 'Menu' }
  ];

  const currentTab = () => (typeof appState !== 'undefined' && appState.activeTab) || 'list';

  /* ---------- bottom nav ---------- */
  function buildNav() {
    if ($('mbNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'mbNav'; nav.className = 'no-print'; nav.setAttribute('aria-label', 'Navigasi utama');
    nav.innerHTML = ITEMS.map(i =>
      `<button type="button" data-mb="${i.tab}" aria-label="${i.label}"><i class="fa-solid ${i.icon}"></i><span>${i.label}</span>${i.badge ? '<b class="mb-dot" id="mbBadge" hidden></b>' : ''}</button>`
    ).join('');
    const tg = document.createElement('button');
    tg.type = 'button'; tg.id = 'mbToggle'; tg.setAttribute('aria-label', 'Sembunyikan / tampilkan menu bawah');
    nav.appendChild(tg);
    try { document.body.classList.toggle('mb-collapsed', localStorage.getItem('ga_mb_collapsed') === '1'); } catch (_) {}
    tg.addEventListener('click', () => {
      const c = document.body.classList.toggle('mb-collapsed'); closeSheet();
      try { localStorage.setItem('ga_mb_collapsed', c ? '1' : '0'); } catch (_) {}
    });
    nav.addEventListener('click', e => {
      const b = e.target.closest('button[data-mb]'); if (!b) return;
      const t = b.dataset.mb;
      if (t === '__menu') return toggleSheet();
      closeSheet(); window.switchTab(t);
    });
    document.body.appendChild(nav);
  }

  function syncNav() {
    const cur = currentTab();
    const direct = ITEMS.some(i => i.tab === cur);
    document.querySelectorAll('#mbNav button').forEach(b => {
      const t = b.dataset.mb;
      b.classList.toggle('on', t === cur || (t === '__menu' && !direct) || (t === '__menu' && $('mbSheet') && $('mbSheet').classList.contains('show')));
    });
    // jumlah tiket di tombol "Tiket"
    const src = $('nav-count-badge'), dot = $('mbBadge');
    if (src && dot) { const n = parseInt(src.textContent, 10) || 0; dot.textContent = n > 99 ? '99+' : n; dot.hidden = !n; }
  }

  /* ---------- lembar Menu ---------- */
  function hiddenByRole(el) {
    for (let n = el; n && n.id !== 'sidebar'; n = n.parentElement) {
      if (n.style && n.style.display === 'none') return true;
      if (n.classList && n.classList.contains('hidden')) return true;
    }
    return false;
  }

  function buildSheet() {
    let sh = $('mbSheet');
    if (!sh) {
      const bd = document.createElement('div'); bd.id = 'mbBackdrop'; bd.addEventListener('click', closeSheet);
      sh = document.createElement('div'); sh.id = 'mbSheet'; sh.className = 'no-print';
      sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Menu');
      document.body.append(bd, sh);
      sh.addEventListener('click', e => {
        const t = e.target.closest('[data-go]');
        if (t) { closeSheet(); window.switchTab(t.dataset.go); return; }
        const a = e.target.closest('[data-act]'); if (!a) return;
        const act = a.dataset.act;
        if (act === 'theme') { window.toggleTheme(); fillSheet(); }
        else if (act === 'pass') { closeSheet(); window.openModal('passwordModal'); }
        else if (act === 'logout') { closeSheet(); window.handleLogout(); }
        else if (act === 'install' && window.PWA && window.PWA.install) { window.PWA.install().then(() => fillSheet()); }
      });
      // geser ke bawah pada lembar untuk menutup
      let y0 = null;
      sh.addEventListener('touchstart', e => { y0 = (sh.scrollTop <= 0 || e.target.closest('.mb-grip')) ? e.touches[0].clientY : null; }, { passive: true });
      sh.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) closeSheet(); y0 = null; }, { passive: true });
    }
    fillSheet();
  }

  function fillSheet() {
    const sh = $('mbSheet'); if (!sh) return;
    const cur = currentTab();
    const name = ($('displayUserName') || {}).textContent || 'Pengguna';
    const role = ($('displayUserRole') || {}).textContent || '';
    const light = (window.getTheme && window.getTheme()) === 'light';

    // ambil menu langsung dari sidebar supaya selalu sama dengan versi desktop (termasuk pembatasan peran)
    let secs = '';
    document.querySelectorAll('#sidebar nav > p, #sidebar nav > div').forEach(node => {
      const group = node.tagName === 'P' ? null : node;
      if (!group) return;
      const title = (group.querySelector('p') || {}).textContent || '';
      const tiles = [...group.querySelectorAll('button[id^="tab-"]')].filter(b => !hiddenByRole(b)).map(b => {
        const tab = b.id.slice(4);
        const ic = (b.querySelector('i') || {}).className || 'fa-solid fa-circle';
        const lbl = b.textContent.replace(/\s+/g, ' ').trim().replace(/\s\d+$/, '');
        return `<button type="button" class="mb-tile${tab === cur ? ' on' : ''}" data-go="${esc(tab)}"><i class="${esc(ic.replace(/\bw-4\b|\btext-center\b/g, '').trim())}"></i><span>${esc(lbl)}</span></button>`;
      });
      if (tiles.length) secs += `<div class="mb-sec">${esc(title)}</div><div class="mb-grid">${tiles.join('')}</div>`;
    });
    // menu utama (Buat / Daftar) sudah ada di sidebar group pertama? bila tidak (bukan <div>), tambahkan manual
    if (!/data-go="form"/.test(secs)) {
      secs = `<div class="mb-sec">Menu Utama</div><div class="mb-grid">
        <button type="button" class="mb-tile${cur === 'form' ? ' on' : ''}" data-go="form"><i class="fa-solid fa-pen-to-square"></i><span>Buat Permintaan</span></button>
        <button type="button" class="mb-tile${cur === 'list' ? ' on' : ''}" data-go="list"><i class="fa-solid fa-list-check"></i><span>Daftar &amp; Status</span></button></div>` + secs;
    }

    const canInstall = window.PWA && window.PWA.deferred;
    sh.innerHTML = `<div class="mb-grip"></div><div class="mb-body">
      <div class="mb-user"><div class="mb-avatar">${esc(name.trim().charAt(0).toUpperCase() || 'U')}</div>
        <div style="min-width:0"><div class="mb-uname">${esc(name)}</div><div class="mb-urole">${esc(role)}</div></div></div>
      ${secs}
      <div class="mb-sec">Pengaturan</div>
      <div class="mb-rows">
        <button type="button" class="mb-row" data-act="theme"><i class="fa-solid ${light ? 'fa-moon' : 'fa-sun'}"></i>${light ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}</button>
        <button type="button" class="mb-row" data-act="pass"><i class="fa-solid fa-key"></i>Ubah password</button>
        ${canInstall ? '<button type="button" class="mb-row" data-act="install"><i class="fa-solid fa-download"></i>Pasang aplikasi di layar utama</button>' : ''}
        <button type="button" class="mb-row danger" data-act="logout"><i class="fa-solid fa-power-off"></i>Keluar (Logout)</button>
      </div></div>`;
  }

  function openSheet() { buildSheet(); $('mbBackdrop').classList.add('show'); $('mbSheet').classList.add('show'); document.body.style.overflow = 'hidden'; syncNav(); }
  function closeSheet() {
    const sh = $('mbSheet'); if (!sh) return;
    sh.classList.remove('show'); $('mbBackdrop').classList.remove('show'); document.body.style.overflow = ''; syncNav();
  }
  function toggleSheet() { const sh = $('mbSheet'); sh && sh.classList.contains('show') ? closeSheet() : openSheet(); }

  /* ---------- tabel => kartu ---------- */
  const lbl = th => th.textContent.replace(/\s+/g, ' ').trim();
  function cardify(table) {
    if (table.closest('#printable-area, .swal2-container, #mbSheet')) return;
    const ths = table.querySelectorAll('thead th'); if (!ths.length) return;
    const labels = [...ths].map(lbl);
    table.classList.add('mb-cards');
    table.querySelectorAll('tbody > tr').forEach(tr => {
      const cells = [...tr.children];
      if (cells.some(c => (c.colSpan || 1) > 1) || cells.length !== labels.length) { tr.classList.add('mb-span'); return; }
      tr.classList.remove('mb-span');
      cells.forEach((c, i) => {
        const l = /^aksi$/i.test(labels[i]) ? '' : labels[i];
        if (c.getAttribute('data-label') !== l) c.setAttribute('data-label', l);
        // bungkus isi sel jadi satu blok agar teks/nama/cabang tidak terpecah berjajar menyamping
        if (!(c.firstElementChild && c.firstElementChild.classList.contains('mb-val') && c.children.length === 1)) {
          const w = document.createElement('div'); w.className = 'mb-val';
          while (c.firstChild) w.appendChild(c.firstChild);
          c.appendChild(w);
        }
      });
    });
  }
  const cardifyAll = () => { if (mq.matches) document.querySelectorAll('main table').forEach(cardify); };
  let raf = 0;
  const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; cardifyAll(); }); };

  /* ---------- pasang ---------- */
  function init() {
    // viewport penuh sampai area notch (dibutuhkan agar env(safe-area-inset-*) bernilai)
    const vp = document.querySelector('meta[name=viewport]');
    if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';

    const main = document.querySelector('main'); if (main && main.parentElement) main.parentElement.classList.add('mb-scroll');
    buildNav(); syncNav();

    // status login: tampilkan bottom-nav hanya setelah masuk
    const lm = $('loginModal');
    const auth = () => document.body.classList.toggle('mb-authed', !!lm && lm.classList.contains('hidden'));
    if (lm) { new MutationObserver(() => { auth(); fillSheet(); syncNav(); }).observe(lm, { attributes: true, attributeFilter: ['class'] }); }
    auth();

    // sinkron saat berpindah tab
    const orig = window.switchTab;
    window.switchTab = function () {
      const r = orig.apply(this, arguments);
      syncNav(); closeSheet();
      const sc = document.querySelector('.mb-scroll'); if (sc && mq.matches) sc.scrollTo({ top: 0 });
      schedule();
      return r;
    };

    // badge jumlah tiket
    const cb = $('nav-count-badge'); if (cb) new MutationObserver(syncNav).observe(cb, { childList: true, characterData: true, subtree: true });

    // tabel dirender ulang oleh aplikasi => labelkan lagi
    if (main) new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { document.querySelectorAll('table.mb-cards').forEach(t => { if (!mq.matches) t.classList.remove('mb-cards'); }); schedule(); closeSheet(); });
    cardifyAll();

    // sembunyikan bottom-nav saat keyboard layar terbuka
    let kbT;
    document.addEventListener('focusin', e => { if (mq.matches && e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=file]), textarea, select')) { clearTimeout(kbT); document.body.classList.add('mb-kb'); } });
    document.addEventListener('focusout', () => { clearTimeout(kbT); kbT = setTimeout(() => document.body.classList.remove('mb-kb'), 120); });

    // tombol Back di Android menutup lembar menu
    window.addEventListener('popstate', () => closeSheet());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
