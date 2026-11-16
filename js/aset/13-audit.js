/* Modul Aset: Audit Log.
   Mencatat SIAPA mengubah APA pada aset (nilai lama -> nilai baru), selain "Riwayat" teks yang sudah ada.

   Cara kerja: AUD.capture() dipanggil di awal save() (01-core.js). Ia membandingkan daftar aset saat ini
   dengan foto (snapshot) terakhir, lalu menulis selisihnya sebagai entri audit. Foto diperbarui setelah
   setiap capture dan setiap data cloud masuk (applyCloudNow), jadi perubahan orang lain tidak tercatat
   dua kali atas nama Anda.

   Penyimpanan: settings/asset_audit_YYYY-MM  ->  { e: { [idEntri]: entri } }  (satu dokumen per bulan,
   ditulis dengan merge supaya penulisan bersamaan tidak saling menimpa). Entri yang belum terkirim
   antre di localStorage dan dikirim ulang saat online. */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const FIELDS = { name: 'Nama', category: 'Kategori', branch: 'Cabang', division: 'Divisi', qty: 'Qty', price: 'Harga/unit', status: 'Status', date: 'Tgl perolehan',
    vendorId: 'Vendor', mtcDate: 'Jadwal servis', mtcNote: 'Catatan servis', mtcCost: 'Biaya servis', nfiles: 'Jumlah lampiran' };
  const MONEY = { price: 1, mtcCost: 1 };
  const QKEY = 'ga_aud_q', BULK = 40, PAGE = 50;
  const AUD = window.AUD = { snap: null, cache: {}, ym: null, f: { by: '', q: '', fld: '' }, page: 1, rows: [] };

  const ym = ts => { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}`; };
  const pick = a => { const o = {}; for (const f in FIELDS) o[f] = f === 'nfiles' ? String((a.files || []).length) : (a[f] == null ? '' : String(a[f])); return o; };
  const qload = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } };
  const qsave = q => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-3000))); } catch (e) {} };
  const eid = () => 'E' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const shown = (f, v) => v === '' || v == null ? '—' : f === 'status' ? ((ST[v] || [])[1] || v) : f === 'vendorId' ? ((AM.vendors.find(x => x.id === v) || {}).name || v) : MONEY[f] ? rp(Number(v)) : v;

  AUD.rebase = function () { const s = new Map(); AM.assets.forEach(a => s.set(a.id, pick(a))); AUD.snap = s; };

  AUD.capture = function () {
    try {
      if (!AUD.snap) return;
      const u = user() || {}, base = { ts: Date.now(), by: u.name || 'System', role: u.role || '' }, out = [];
      const next = new Map(), cur = new Map(AM.assets.map(a => [a.id, a]));
      const created = [], removed = [];
      cur.forEach((a, id) => {
        const now = pick(a); next.set(id, now); const was = AUD.snap.get(id);
        if (!was) { created.push(a); return; }
        for (const f in FIELDS) if (was[f] !== now[f]) out.push({ ...base, a: id, an: a.name, f, o: was[f], n: now[f] });
      });
      AUD.snap.forEach((was, id) => { if (!cur.has(id)) removed.push({ id, name: was.name }); });
      if (created.length > BULK) out.push({ ...base, a: '(banyak)', an: '', f: '+', o: '', n: `${created.length} aset baru ditambahkan sekaligus (impor / sinkron permintaan)` });
      else created.forEach(a => out.push({ ...base, a: a.id, an: a.name, f: '+', o: '', n: `${a.name} · qty ${q(a)} · ${a.branch || 'tanpa cabang'}` }));
      if (removed.length > BULK) out.push({ ...base, a: '(banyak)', an: '', f: '-', o: `${removed.length} aset dihapus sekaligus`, n: '' });
      else removed.forEach(r => out.push({ ...base, a: r.id, an: r.name, f: '-', o: r.name, n: '' }));
      AUD.snap = next;
      if (!out.length) return;
      const qq = qload(); out.forEach(e => { e.id = eid(); qq.push(e); }); qsave(qq);
      AUD.flush();
    } catch (e) { console.error('Audit capture:', e); }
  };

  let flushing = false;
  AUD.flush = async function () {
    if (flushing || !window.db || !navigator.onLine) return; flushing = true;
    try {
      const { setDoc, doc } = window.fbDeps; let qq = qload();
      const byMonth = {}; qq.forEach(e => (byMonth[ym(e.ts)] = byMonth[ym(e.ts)] || []).push(e));
      for (const m of Object.keys(byMonth)) {
        const e = {}; byMonth[m].forEach(x => { e[x.id] = x; });
        await setDoc(doc(window.db, 'settings', 'asset_audit_' + m), { e }, { merge: true });
        const sent = new Set(byMonth[m].map(x => x.id)); qq = qq.filter(x => !sent.has(x.id)); qsave(qq); delete AUD.cache[m];
      }
    } catch (e) { console.warn('Audit flush ditunda:', e.code || e); }
    flushing = false;
  };
  window.addEventListener('online', () => AUD.flush());
  window.addEventListener('profile-ready', () => setTimeout(() => AUD.flush(), 3000));

  /* ---------- tampilan (GA) ---------- */
  async function loadMonth(m) {
    let list = [];
    if (window.db) {
      try { const { getDoc, doc } = window.fbDeps; const s = await getDoc(doc(window.db, 'settings', 'asset_audit_' + m)); if (s.exists()) list = Object.values(s.data().e || {}); AUD.cache[m] = list; }
      catch (e) { list = AUD.cache[m] || []; }
    }
    const have = new Set(list.map(x => x.id));
    return list.concat(qload().filter(x => ym(x.ts) === m && !have.has(x.id)));
  }
  const months = () => { const o = [], d = new Date(); for (let i = 0; i < 12; i++) { o.push(ym(new Date(d.getFullYear(), d.getMonth() - i, 1))); } return o; };
  const fmt = ts => new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const fldLabel = f => f === '+' ? 'Aset baru' : f === '-' ? 'Aset dihapus' : (FIELDS[f] || f);

  function filtered() {
    const f = AUD.f, qq = f.q.toLowerCase(), bb = f.by.toLowerCase();
    return AUD.rows.filter(e => (!bb || (e.by || '').toLowerCase().includes(bb)) && (!f.fld || e.f === f.fld) && (!qq || (e.an || '').toLowerCase().includes(qq) || (e.a || '').toLowerCase().includes(qq)));
  }
  function table() {
    const L = filtered().sort((a, b) => b.ts - a.ts), tp = Math.max(1, Math.ceil(L.length / PAGE)); AUD.page = Math.min(AUD.page, tp);
    const rows = L.slice((AUD.page - 1) * PAGE, AUD.page * PAGE).map(e => `<tr class="hover:bg-white/[0.02]"><td class="p-4 whitespace-nowrap">${esc(fmt(e.ts))}${sub(esc(e.by || '-'))}</td>
      <td class="p-4 font-bold text-white">${esc(e.an || e.a)}${e.an ? sub(esc(e.a)) : ''}</td><td class="p-4">${esc(fldLabel(e.f))}</td>
      <td class="p-4">${e.f === '+' ? esc(e.n) : e.f === '-' ? esc(e.o) : `<span class="text-dobah-200/60 line-through">${esc(shown(e.f, e.o))}</span> <i class="fa-solid fa-arrow-right text-[10px] text-dobah-400 mx-1"></i> <b class="text-white">${esc(shown(e.f, e.n))}</b>`}</td></tr>`).join('');
    $('audTbl').innerHTML = tbl(th('Waktu / Oleh', 'Aset', 'Perubahan', 'Detail'), rows, 'Tidak ada catatan perubahan pada filter ini.');
    $('audInfo').textContent = `${L.length} catatan · Hal ${AUD.page}/${tp}`;
  }
  AUD.pg = d => { AUD.page = Math.max(1, AUD.page + d); table(); };
  AUD.setF = (k, v) => { AUD.f[k] = v; AUD.page = 1; table(); };
  AUD.setMonth = async v => { AUD.ym = v; $('audInfo').textContent = 'Memuat...'; AUD.rows = await loadMonth(v); table(); };
  AUD.csv = () => {
    const L = filtered().sort((a, b) => b.ts - a.ts);
    GAX.csv(`audit_aset_${AUD.ym}.csv`, [['Waktu', 'Oleh', 'Role', 'ID Aset', 'Nama Aset', 'Jenis', 'Nilai Lama', 'Nilai Baru'],
      ...L.map(e => [new Date(e.ts).toLocaleString('id-ID'), e.by, e.role, e.a, e.an, fldLabel(e.f), e.f === '+' ? '' : shown(e.f, e.o), e.f === '+' ? e.n : shown(e.f, e.n)])]);
  };
  AUD.render = async function () {
    const v = $('view-aaud'); if (!v) return; if (!isGA()) return;
    AUD.ym = AUD.ym || ym(Date.now()); const inp = 'glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold';
    v.innerHTML = `<p class="text-xs text-dobah-200/70 max-w-2xl">Catatan otomatis setiap kali data aset diubah: siapa, kapan, dan nilai sebelum &rarr; sesudahnya. Pengajuan punya audit trail sendiri di menu Daftar &amp; Status Permintaan.</p>
      <div class="glass-panel p-4 flex flex-wrap gap-3 items-center"><select onchange="AUD.setMonth(this.value)" class="${inp}">${months().map(m => `<option value="${m}" ${m === AUD.ym ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input oninput="AUD.setF('by',this.value)" value="${esc(AUD.f.by)}" placeholder="Filter pengguna" class="${inp} min-w-[140px]"><input oninput="AUD.setF('q',this.value)" value="${esc(AUD.f.q)}" placeholder="Cari aset / ID" class="${inp} flex-1 min-w-[160px]">
      <select onchange="AUD.setF('fld',this.value)" class="${inp}"><option value="">Semua jenis</option><option value="+" ${AUD.f.fld === '+' ? 'selected' : ''}>Aset baru</option><option value="-" ${AUD.f.fld === '-' ? 'selected' : ''}>Aset dihapus</option>${Object.entries(FIELDS).map(([k, l]) => `<option value="${k}" ${AUD.f.fld === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button onclick="AUD.csv()" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-4 py-2 border border-white/10"><i class="fa-solid fa-file-csv mr-1"></i>Export</button></div>
      <div id="audTbl"></div><div class="flex justify-between items-center text-xs text-dobah-200"><span id="audInfo">Memuat...</span><span><button onclick="AUD.pg(-1)" class="modern-button bg-cocoa-800 px-3 py-1.5 border border-white/10">&lsaquo; Prev</button> <button onclick="AUD.pg(1)" class="modern-button bg-cocoa-800 px-3 py-1.5 border border-white/10">Next &rsaquo;</button></span></div>`;
    AUD.rows = await loadMonth(AUD.ym); table();
  };

  GAX.regTab('aaud', { title: 'Audit Log Aset', render: () => AUD.render(), gaOnly: true });
})();
