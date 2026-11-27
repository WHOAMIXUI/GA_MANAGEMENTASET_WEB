/* Modul Aset: kartu "Perlu tindakan hari ini" di Dashboard Aset (khusus GA Manager).
   Dimuat setelah 20-tasks.js. Tidak menyimpan apa pun dan tidak menambah koleksi/aturan Firestore:
   semuanya dihitung dari data yang SUDAH dimuat aplikasi.

   Empat sumber:
   1. Approval tertunda      -> tiket berstatus "Approval Manager Ops" / "Approval Finance"   (appState.requests)
   2. Peminjaman lewat tempo -> AM.loans yang belum kembali dan batasnya sudah lewat
   3. Garansi hampir habis   -> lampiran aset (a.files[].exp) yang berakhir dalam 30 hari ke depan.
                                Garansi yang SUDAH berakhir sengaja tidak dihitung: kalau dihitung, kartu ini
                                tidak akan pernah kosong lagi karena tanggal lampirannya tidak pernah hilang.
   4. Maintenance jatuh tempo-> aset Maintenance/Rusak yang jadwal servisnya (mtcDate) hari ini atau terlewat,
                                + Pengingat Pekerjaan kategori Maintenance Aset / Sarana & Prasarana yang
                                tenggatnya hari ini atau terlewat.

   Kartu digambar ulang sendiri (tanpa menyentuh grafik) saat data berubah: lewat NC.scan dan TK.notify. */
(() => {
  const WARN_DAYS = 30;
  const MAINT_CATS = ['Maintenance Aset', 'Sarana & Prasarana'];
  const SHOW = 3; // baris yang ditampilkan per bagian; sisanya lewat tombol "Buka daftar"
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const TODAY = window.TODAY = {};

  const fd = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d)) ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '-';
  const ageDays = d => { const n = Math.floor((new Date(today()) - new Date(d)) / 864e5); return Number.isFinite(n) ? Math.max(0, n) : 0; };
  const late = n => n < 0 ? `Terlambat ${-n} hari` : 'Hari ini';

  /* ---------- pengumpul data ---------- */
  function approvals() {
    const L = (typeof getAccessibleRequests === 'function' ? getAccessibleRequests() : []).filter(r => APPROVAL.includes(r.status));
    // Umur dihitung dari tanggal pengajuan: itu satu-satunya tanggal tiket yang formatnya pasti.
    return L.map(r => ({ r, age: ageDays(r.submissionDate) })).sort((a, b) => b.age - a.age).map(({ r, age }) => ({
      go: 'appr', hot: age >= 3,
      t: `${esc(r.id)} · ${esc(r.branch || '-')}`,
      s: `${esc((TSTAT[r.status] || {}).short || r.status)} · ${age ? 'diajukan ' + age + ' hari lalu' : 'diajukan hari ini'}`
    }));
  }

  function loans() {
    // overdue() = dipakai juga oleh dashboard & notifikasi: belum kembali dan batasnya SUDAH lewat (bukan yang jatuh tempo hari ini)
    return overdue().sort((a, b) => String(a.due).localeCompare(String(b.due))).map(l => { const a = find(l.assetId), d = days(l.due); return {
      go: 'loan', hot: true,
      t: `${esc(l.name)} · ${a ? esc(a.name) : '(aset dihapus)'}`,
      s: `${late(d)} (batas ${fd(l.due)}) · ${l.qty} unit`
    }; });
  }

  function warranty() {
    const out = [];
    AM.assets.forEach(a => {
      if (dead(a)) return;
      let best = null; // satu aset bisa punya beberapa lampiran garansi: ambil yang paling dekat berakhir
      (a.files || []).forEach(f => { if (!f.exp) return; const d = days(f.exp); if (d >= 0 && d <= WARN_DAYS && (!best || d < best.d)) best = { d, exp: f.exp }; });
      if (best) out.push({ a, ...best });
    });
    return out.sort((x, y) => x.d - y.d).map(({ a, d, exp }) => ({
      go: 'warr', id: a.id, hot: d <= 7,
      t: `${esc(a.name)} · ${esc(a.branch || '-')}`,
      s: `${d === 0 ? 'Berakhir hari ini' : d + ' hari lagi'} (${fd(exp)})`
    }));
  }

  function maint() {
    const out = [];
    AM.assets.forEach(a => {
      if (!(a.status === 'Maintenance' || a.status === 'Broken') || !a.mtcDate) return;
      const d = days(a.mtcDate); if (!(d <= 0)) return;
      out.push({ d, row: { go: 'mtc', hot: d < 0, t: `${esc(a.name)} · ${esc(a.branch || '-')}`, s: `Servis aset: ${late(d)} (jadwal ${fd(a.mtcDate)})` } });
    });
    if (window.TK && TK.due) TK.due(MAINT_CATS).forEach(t => {
      const d = days(t.due);
      out.push({ d, row: { go: 'task', hot: d < 0, t: `${esc(t.name)}${t.branch ? ' · ' + esc(t.branch) : ''}`, s: `Pekerjaan: ${late(d)} (tenggat ${fd(t.due)})` } });
    });
    return out.sort((x, y) => x.d - y.d).map(x => x.row);
  }

  const SECTIONS = [
    { k: 'appr', title: 'Approval tertunda', icon: 'fa-ticket', tone: 'text-sky-400', get: approvals, open: 'Buka tiket' },
    { k: 'loan', title: 'Peminjaman lewat tempo', icon: 'fa-right-left', tone: 'text-rose-400', get: loans, open: 'Buka peminjaman' },
    { k: 'warr', title: 'Garansi hampir habis (≤ 30 hari)', icon: 'fa-file-contract', tone: 'text-amber-400', get: warranty, open: 'Buka registry' },
    { k: 'mtc', title: 'Maintenance jatuh tempo', icon: 'fa-screwdriver-wrench', tone: 'text-amber-400', get: maint, open: 'Buka maintenance' }
  ];

  /* ---------- tampilan ---------- */
  TODAY.html = function () {
    if (!isGA() || !AM.loaded) return '';
    const S = SECTIONS.map(s => ({ ...s, rows: s.get() })), total = S.reduce((n, s) => n + s.rows.length, 0);
    const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const sec = s => {
      const n = s.rows.length;
      const lines = s.rows.slice(0, SHOW).map(r => `<button type="button" class="gt-line" data-gt="${r.go}"${r.id ? ` data-id="${esc(r.id)}"` : ''}>
        <span class="min-w-0"><span class="block font-bold text-dobah-100 break-words">${r.t}</span><span class="block text-[11px] ${r.hot ? 'text-rose-400 font-bold' : 'text-dobah-200/70'}">${r.s}</span></span>
        <i class="fa-solid fa-chevron-right text-dobah-200/40 shrink-0" aria-hidden="true"></i></button>`).join('');
      return `<section class="gt-sec ${n ? 'has' : ''}" aria-label="${esc(s.title)}">
        <div class="flex items-center justify-between gap-2"><h4 class="text-xs font-extrabold text-white"><i class="fa-solid ${s.icon} ${s.tone} mr-2" aria-hidden="true"></i>${s.title}</h4><span class="gt-n" aria-label="${n} item">${n}</span></div>
        ${n ? lines : '<p class="gt-none text-[11px] text-dobah-200/60"><i class="fa-solid fa-circle-check text-emerald-400 mr-1" aria-hidden="true"></i>Tidak ada yang perlu ditangani.</p>'}
        ${n ? `<button type="button" class="gt-more text-[11px] font-bold text-dobah-300 underline" data-gt="${s.k}">${n > SHOW ? `Lihat semua ${n} · ` : ''}${s.open}</button>` : ''}
      </section>`;
    };
    return `<div id="gaToday" class="glass-panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h3 class="text-sm font-bold text-white"><i class="fa-solid fa-bell text-dobah-400 mr-2" aria-hidden="true"></i>Perlu tindakan hari ini</h3><p class="text-[11px] text-dobah-200/60 mt-0.5">${esc(date)}</p></div>
        <span class="gt-total ${total ? 'has' : ''}" role="status">${total ? `${total} hal perlu ditangani` : '<i class="fa-solid fa-circle-check mr-1" aria-hidden="true"></i>Semua beres hari ini'}</span></div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${S.map(sec).join('')}</div></div>`;
  };

  // Gambar ulang kartu saja (bukan seluruh dashboard) supaya grafik tidak berkedip.
  TODAY.refresh = function () {
    if (appState.activeTab !== 'adash') return;
    const el = $('gaToday'), h = TODAY.html();
    if (!h) { if (el) el.remove(); return; }
    if (el) el.outerHTML = h; else { const v = $('view-adash'); if (v) v.insertAdjacentHTML('afterbegin', h); }
  };

  /* ---------- navigasi (satu pendengar untuk semua tombol di kartu; id tidak pernah masuk ke atribut onclick) ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#gaToday [data-gt]'); if (!b) return;
    const go = b.dataset.gt;
    if (go === 'appr') { switchTab('list'); if (typeof openTicketList === 'function') openTicketList('APPROVAL'); }
    else if (go === 'loan') { AM.loanTab = 'active'; switchTab('aasg'); }
    else if (go === 'warr') { if (b.dataset.id && window.ATT) ATT.open(b.dataset.id); else switchTab('areg'); }
    else if (go === 'mtc') switchTab('amtc');
    else if (go === 'task') switchTab('atsk');
  });

  /* ---------- kapan kartu diperbarui ---------- */
  const _scan = NC.scan; // dipanggil tiap data tiket/aset berubah, tiap 5 menit, dan saat tab kembali aktif (juga menangani pergantian hari)
  NC.scan = function () { const r = _scan.apply(this, arguments); try { TODAY.refresh(); } catch (e) { console.error('Kartu hari ini:', e); } return r; };
  if (window.TK && TK.notify) { const _n = TK.notify; TK.notify = function () { const r = _n.apply(this, arguments); try { TODAY.refresh(); } catch (e) { console.error(e); } return r; }; }
})();
