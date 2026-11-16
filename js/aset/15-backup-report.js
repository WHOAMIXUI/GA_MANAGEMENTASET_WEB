/* Modul Aset: Backup / Restore menyeluruh + Laporan PDF (bulanan & rekap per cabang). Khusus GA Manager.

   Isi backup (satu file .json): seluruh data modul aset (aset, vendor, kontak, umur ekonomis, peminjaman, pasar
   antar toko, insiden), pengajuan, sesi stock opname, audit log 12 bulan terakhir, dan master data. Opsional:
   isi file lampiran + foto bukti pemusnahan (file jadi besar).
   Restore SELALU mengunduh backup pengaman dari kondisi saat ini lebih dulu, lalu meminta ketik PULIHKAN.

   PDF dibuat di browser dengan jsPDF + AutoTable yang dimuat dari CDN saat pertama dipakai (butuh internet
   sekali; setelah itu disimpan service worker). */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const BKP = window.BKP = {};
  const FMT = 'GA_MANAGEMENTASET', VERSION = 1, LAST = 'ga_bkp_last', CH = 700000;
  const R = n => rp(n).replace(/\u00a0/g, ' ');
  const ymNow = () => today().slice(0, 7);
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const ymLabel = ym => MONTHS[parseInt(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  const lget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  const busy = t => Swal.fire({ title: t, allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), ...SW });

  /* ====================== BACKUP ====================== */
  async function fetchDoc(col, id) { if (!window.db) return null; try { const { getDoc, doc } = window.fbDeps; const s = await timeout(getDoc(doc(window.db, col, id)), 15000); return s.exists() ? s.data() : null; } catch (e) { return null; } }
  async function collectBackup(withBlobs, progress) {
    const u = user() || {};
    const d = { app: FMT, v: VERSION, at: new Date().toISOString(), by: u.name || '',
      asset: { assets: AM.assets, vendors: AM.vendors, contacts: AM.contacts, life: AM.life, loans: AM.loans, market: AM.market, trades: AM.trades, incidents: AM.incidents },
      requests: (appState.requests || []).slice(),
      master: { categories: appState.categories, divisions: appState.divisions, branches: appState.branches, contactTypes: appState.contactTypes },
      opname: { index: (window.OPN && OPN.idx) || {}, sessions: {} }, audit: {}, blobs: null };
    progress('Mengambil sesi opname...');
    for (const s of Object.values(d.opname.index)) { if (s.deleted) continue; d.opname.sessions[s.id] = (await fetchDoc('settings', 'opname_' + s.id)) || lget('ga_opn_s_' + s.id); }
    progress('Mengambil audit log...');
    const now = new Date();
    for (let i = 0; i < 12; i++) { const m = new Date(now.getFullYear(), now.getMonth() - i, 1), k = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'); const x = await fetchDoc('settings', 'asset_audit_' + k); if (x && x.e) d.audit[k] = x.e; }
    if (withBlobs) {
      d.blobs = { att: {}, photos: {} };
      const atts = AM.assets.flatMap(a => (a.files || [])), phs = AM.assets.flatMap(a => ((a.disposal || {}).photos || []));
      let n = 0, tot = atts.length + phs.length;
      for (const f of atts) { progress(`Lampiran ${++n}/${tot}...`); let s = ''; for (let i = 0; i < f.chunks; i++) { const c = await fetchDoc('asset_photos', `${f.id}_${i}`); if (c) s += c.data; } if (s) d.blobs.att[f.id] = s; }
      for (const id of phs) { progress(`Foto ${++n}/${tot}...`); const c = await fetchDoc('asset_photos', id); if (c) d.blobs.photos[id] = c.data; }
    }
    return d;
  }
  async function downloadBackup(withBlobs, tag) {
    busy('Menyiapkan backup...');
    try {
      const d = await collectBackup(withBlobs, t => { const e = Swal.getTitle(); if (e) e.textContent = t; });
      GAX.download(`backup_ga_aset_${tag || ''}${GAX.stamp()}.json`, new Blob([JSON.stringify(d)], { type: 'application/json' }));
      localStorage.setItem(LAST, String(Date.now())); Swal.close(); return d;
    } catch (e) { console.error(e); Swal.fire({ title: 'Backup gagal', text: e.message || '', icon: 'error', ...SW }); return null; }
  }
  BKP.backup = async function () {
    if (!isGA()) return deny();
    const r = await Swal.fire({ title: 'Unduh Backup', ...SW, showCancelButton: true, confirmButtonText: 'Unduh', cancelButtonText: 'Batal',
      html: `<div class="text-left text-xs text-dobah-200"><p class="mb-3">Berisi: aset, vendor, kontak, peminjaman, jual beli, insiden, pengajuan, sesi opname, audit log 12 bulan, dan master data.</p>
        <label class="flex gap-2 items-start"><input type="checkbox" id="bkBlob" class="mt-0.5"><span>Sertakan <b>isi file</b> lampiran dan foto bukti pemusnahan (file backup bisa jadi puluhan MB).</span></label></div>`,
      preConfirm: () => ({ blobs: $('bkBlob').checked }) });
    if (r.isConfirmed) { await downloadBackup(r.value.blobs); BKP.render(); }
  };

  /* ====================== RESTORE ====================== */
  BKP.restore = function () {
    if (!isGA()) return deny();
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      let d; try { d = JSON.parse(await f.text()); } catch (e) { return Swal.fire({ title: 'File tidak valid', text: 'File bukan JSON yang benar.', icon: 'error', ...SW }); }
      if (!d || d.app !== FMT || !d.asset || !Array.isArray(d.asset.assets)) return Swal.fire({ title: 'Bukan file backup GA Aset', icon: 'error', ...SW });
      if (d.v > VERSION) return Swal.fire({ title: 'Versi backup lebih baru', text: 'Perbarui aplikasi dulu sebelum memulihkan file ini.', icon: 'warning', ...SW });
      const A = d.asset, nSes = Object.keys((d.opname || {}).sessions || {}).length, hasB = !!d.blobs;
      const r = await Swal.fire({ title: 'Pulihkan dari backup?', icon: 'warning', ...SW, confirmButtonColor: '#e11d48', showCancelButton: true, confirmButtonText: 'Pulihkan', cancelButtonText: 'Batal', width: 560,
        html: `<div class="text-left text-xs text-dobah-200 space-y-2"><p>Backup tanggal <b class="text-white">${esc(new Date(d.at).toLocaleString('id-ID'))}</b> oleh <b class="text-white">${esc(d.by || '-')}</b>:</p>
          <p class="font-mono">${A.assets.length} aset · ${(A.vendors || []).length} vendor · ${(A.loans || []).length} peminjaman · ${(A.incidents || []).length} insiden · ${nSes} sesi opname · ${(d.requests || []).length} pengajuan</p>
          <p class="text-rose-300 font-bold">Data aset saat ini akan DIGANTI dengan isi backup. Backup pengaman dari kondisi sekarang akan diunduh otomatis lebih dulu.</p>
          <label class="flex gap-2"><input type="checkbox" id="rsReq" ${(d.requests || []).length ? '' : 'disabled'}><span>Pulihkan juga pengajuan (menimpa pengajuan dengan ID sama)</span></label>
          <label class="flex gap-2"><input type="checkbox" id="rsMaster" ${d.master ? '' : 'disabled'}><span>Pulihkan master data (kategori, divisi, cabang)</span></label>
          ${hasB ? '<label class="flex gap-2"><input type="checkbox" id="rsBlob" checked><span>Pulihkan isi lampiran dan foto</span></label>' : ''}
          <label class="block font-bold mt-3">Ketik <span class="font-mono text-white">PULIHKAN</span> untuk melanjutkan</label><input id="rsWord" class="w-full px-3 py-2 text-sm rounded-lg bg-[#150a05] border border-white/10 text-white"></div>`,
        preConfirm: () => { if ($('rsWord').value.trim().toUpperCase() !== 'PULIHKAN') { Swal.showValidationMessage('Ketik PULIHKAN dengan benar'); return false; } return { req: $('rsReq').checked, master: $('rsMaster').checked, blob: !!($('rsBlob') && $('rsBlob').checked) }; } });
      if (!r.isConfirmed) return;
      const safe = await downloadBackup(false, 'SEBELUM_RESTORE_'); if (!safe) return;
      busy('Memulihkan data...');
      try { await applyRestore(d, r.value); Swal.fire({ title: 'Pemulihan selesai', text: 'Data sudah dipulihkan. Muat ulang halaman bila ada tampilan yang belum berubah.', icon: 'success', ...SW }); BKP.render(); }
      catch (e) { console.error(e); Swal.fire({ title: 'Pemulihan gagal sebagian', text: (e.message || '') + ' Backup pengaman sudah terunduh; data lama bisa dipulihkan darinya.', icon: 'error', ...SW }); }
    };
    inp.click();
  };
  async function applyRestore(d, o) {
    const A = d.asset, { setDoc, doc } = window.fbDeps || {};
    AM.assets = A.assets || []; AM.vendors = (A.vendors && A.vendors.length) ? A.vendors : AM.vendors; AM.contacts = A.contacts || []; AM.life = A.life || {};
    AM.loans = A.loans || []; AM.market = A.market || []; AM.trades = A.trades || []; AM.incidents = A.incidents || [];
    AM.sel && AM.sel.clear(); AM.built = false;
    if (window.db) {
      for (const [id, s] of Object.entries((d.opname || {}).sessions || {})) if (s) { try { localStorage.setItem('ga_opn_s_' + id, JSON.stringify(s)); } catch (e) {} await setDoc(doc(window.db, 'settings', 'opname_' + id), s); }
      const idx = (d.opname || {}).index || {}; if (Object.keys(idx).length) { try { localStorage.setItem('ga_opn_idx', JSON.stringify(idx)); } catch (e) {} if (window.OPN) OPN.idx = idx; await setDoc(doc(window.db, 'settings', 'opname_index'), { items: idx }, { merge: true }); }
      for (const [m, e] of Object.entries(d.audit || {})) await setDoc(doc(window.db, 'settings', 'asset_audit_' + m), { e }, { merge: true });
      if (o.master && d.master) { const mm = {}; ['categories', 'divisions', 'branches', 'contactTypes'].forEach(k => { if (Array.isArray(d.master[k])) mm[k] = d.master[k]; }); await setDoc(doc(window.db, 'settings', 'master_config'), mm, { merge: true }); }
      if (o.req) for (const r of (d.requests || [])) { if (!r.docId) continue; const c = { ...r }; delete c.docId; await setDoc(doc(window.db, 'requests', r.docId), c); }
      if (o.blob && d.blobs) {
        for (const [fid, url] of Object.entries(d.blobs.att || {})) for (let i = 0; i * CH < url.length; i++) await setDoc(doc(window.db, 'asset_photos', `${fid}_${i}`), { data: url.slice(i * CH, (i + 1) * CH), ts: Date.now(), by: (user() || {}).name || '', kind: 'att' });
        for (const [pid, url] of Object.entries(d.blobs.photos || {})) await setDoc(doc(window.db, 'asset_photos', pid), { data: url, ts: Date.now(), by: (user() || {}).name || '' });
      }
    }
    if (window.AUD) AUD.capture();
    const ok = await save(true); if (!ok) throw new Error('Data aset belum tersimpan ke cloud.');
  }

  /* ====================== PDF ====================== */
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat ' + src)); document.head.appendChild(s); }); }
  async function pdfLib() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    if (!(window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
  }
  async function newDoc(title, subtitle, landscape) {
    await pdfLib(); const d = new window.jspdf.jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4' }), w = d.internal.pageSize.getWidth();
    d.setFillColor(27, 16, 12); d.rect(0, 0, w, 62, 'F'); d.setTextColor(244, 162, 58); d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text(title, 36, 28);
    d.setTextColor(237, 213, 179); d.setFont('helvetica', 'normal'); d.setFontSize(9); d.text(subtitle, 36, 46); d.setTextColor(30, 30, 30); d.y = 84; return d;
  }
  function heading(d, t) { if (d.y > d.internal.pageSize.getHeight() - 110) { d.addPage(); d.y = 48; } d.setFont('helvetica', 'bold'); d.setFontSize(11); d.setTextColor(167, 93, 34); d.text(t, 36, d.y); d.y += 8; }
  function table(d, head, body, extra) {
    if (!body.length) { d.setFont('helvetica', 'italic'); d.setFontSize(9); d.setTextColor(120, 120, 120); d.text('Tidak ada data.', 36, d.y + 10); d.y += 28; return; }
    d.autoTable({ startY: d.y + 4, head: [head], body, theme: 'grid', margin: { left: 36, right: 36 }, styles: { fontSize: 8, cellPadding: 4, textColor: [40, 40, 40] }, headStyles: { fillColor: [27, 16, 12], textColor: [244, 162, 58] }, alternateRowStyles: { fillColor: [250, 245, 238] }, ...(extra || {}) });
    d.y = d.lastAutoTable.finalY + 20;
  }
  function para(d, t) { d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(60, 60, 60); const L = d.splitTextToSize(t, d.internal.pageSize.getWidth() - 72); d.text(L, 36, d.y + 10); d.y += 14 + L.length * 11; }
  function finish(d, name) {
    const n = d.internal.getNumberOfPages(), w = d.internal.pageSize.getWidth(), h = d.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) { d.setPage(i); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(130, 130, 130); d.text(`Dicetak ${new Date().toLocaleString('id-ID')} oleh ${(user() || {}).name || '-'}`, 36, h - 20); d.text(`Halaman ${i}/${n}`, w - 36, h - 20, { align: 'right' }); }
    d.save(name);
  }
  const pdfErr = e => Swal.fire({ title: 'PDF gagal dibuat', text: /Gagal memuat/.test(e.message) ? 'Pustaka PDF perlu internet saat pertama dipakai. Cek koneksi lalu coba lagi.' : (e.message || ''), icon: 'error', ...SW });

  /* ---------- data laporan ---------- */
  const inMonth = (s, ym) => String(s || '').slice(0, 7) === ym;
  function bucket(L) {
    const c = s => sq(L.filter(a => a.status === s)), act = L.filter(a => !dead(a));
    return { unit: sq(act), good: c('Good'), mtc: c('Maintenance'), broken: c('Broken'), lost: c('Lost'), disp: c('Disposed'), val: act.reduce((s, a) => s + tot(a), 0), book: act.reduce((s, a) => s + dep(a).book, 0), inc: L.filter(a => inc(a) && !dead(a)).length };
  }
  function branchRows() {
    const brs = GAX.branchesAll().sort(), opLast = {}; if (window.OPN) Object.values(OPN.idx).filter(s => s.status === 'final' && !s.deleted).forEach(s => { if (!opLast[s.branch] || s.date > opLast[s.branch]) opLast[s.branch] = s.date; });
    const rows = brs.map(b => { const x = bucket(AM.assets.filter(a => a.branch === b)); return { b, ...x, op: opLast[b] || '-' }; });
    const nb = AM.assets.filter(a => !a.branch); if (nb.length) rows.push({ b: '(Tanpa cabang)', ...bucket(nb), op: '-' });
    return rows;
  }
  BKP.branchRecapCsv = function () {
    const rows = branchRows();
    GAX.csv(`rekap_cabang_${GAX.stamp()}.csv`, [['Cabang', 'Unit Aktif', 'Baik', 'Maintenance', 'Rusak', 'Hilang', 'Dimusnahkan', 'Nilai Perolehan', 'Nilai Buku', 'Data Belum Lengkap', 'Opname Terakhir'], ...rows.map(r => [r.b, r.unit, r.good, r.mtc, r.broken, r.lost, r.disp, r.val, Math.round(r.book), r.inc, r.op])]);
  };
  BKP.branchRecapPdf = async function () {
    busy('Membuat PDF...');
    try {
      const rows = branchRows(), d = await newDoc('Rekap Aset per Cabang', `Per ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, true);
      const T = rows.reduce((t, r) => { ['unit', 'good', 'mtc', 'broken', 'lost', 'disp', 'val', 'book', 'inc'].forEach(k => t[k] = (t[k] || 0) + r[k]); return t; }, {});
      table(d, ['Cabang', 'Unit aktif', 'Baik', 'Mtc', 'Rusak', 'Hilang', 'Musnah', 'Nilai perolehan', 'Nilai buku', 'Belum lengkap', 'Opname terakhir'],
        [...rows.map(r => [r.b, r.unit, r.good, r.mtc, r.broken, r.lost, r.disp, R(r.val), R(r.book), r.inc, r.op]), ['TOTAL', T.unit, T.good, T.mtc, T.broken, T.lost, T.disp, R(T.val), R(T.book), T.inc, '']],
        { didParseCell: h => { if (h.row.index === rows.length) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [237, 213, 179]; } } });
      finish(d, `rekap_cabang_${GAX.stamp()}.pdf`); Swal.close();
    } catch (e) { pdfErr(e); }
  };

  BKP.monthly = async function () {
    if (!isGA()) return deny();
    const r = await ask('Laporan Bulanan (PDF)', [{ k: 'm', l: 'Bulan', t: 'month', v: ymNow(), req: 1 }, { k: 'b', l: 'Cabang', opts: [['', 'Semua cabang'], ...GAX.branchesAll().sort().map(b => [b, b])] }], 'Buat PDF');
    if (!r) return; busy('Membuat PDF...');
    try {
      const ym = r.m, br = r.b, fb = x => !br || x.branch === br, A = AM.assets.filter(fb);
      const d = await newDoc(`Laporan Bulanan Aset - ${ymLabel(ym)}`, br ? `Cabang: ${br}` : 'Semua cabang', false), B = bucket(A);
      heading(d, '1. Ringkasan posisi aset'); table(d, ['Keterangan', 'Nilai'], [['Total unit aktif', B.unit], ['Kondisi baik / maintenance / rusak', `${B.good} / ${B.mtc} / ${B.broken}`], ['Hilang / dimusnahkan (kumulatif)', `${B.lost} / ${B.disp}`], ['Nilai perolehan (aktif)', R(B.val)], ['Nilai buku (aktif)', R(B.book)], ['Aset dengan data belum lengkap', B.inc]]);
      const cat = {}; A.filter(a => !dead(a)).forEach(a => { const k = a.category || '(Belum dikategorikan)'; (cat[k] = cat[k] || { u: 0, v: 0, b: 0 }); cat[k].u += q(a); cat[k].v += tot(a); cat[k].b += dep(a).book; });
      heading(d, '2. Aset per kategori'); table(d, ['Kategori', 'Unit', 'Nilai perolehan', 'Nilai buku'], Object.entries(cat).sort((a, b) => b[1].v - a[1].v).map(([k, v]) => [k, v.u, R(v.v), R(v.b)]));
      const nw = A.filter(a => inMonth(a.date, ym));
      heading(d, `3. Aset diperoleh bulan ini (${nw.length} baris, ${sq(nw)} unit)`); table(d, ['ID', 'Nama', 'Cabang', 'Qty', 'Tanggal', 'Total'], nw.slice(0, 60).map(a => [a.id, a.name, a.branch || '-', q(a), a.date, R(tot(a))]));
      if (nw.length > 60) para(d, `Menampilkan 60 dari ${nw.length} baris.`);
      const rq = (appState.requests || []).filter(x => (!br || x.branch === br) && inMonth(x.submissionDate, ym)), rt = x => (x.items || []).reduce((s, i) => s + (Number(i.cost) || 0) * (parseInt(i.qty) || 1), 0), byS = {}; rq.forEach(x => { byS[x.status] = (byS[x.status] || 0) + 1; });
      heading(d, `4. Pengajuan barang bulan ini (${rq.length})`); table(d, ['Status', 'Jumlah'], Object.entries(byS).map(([k, v]) => [k, v]));
      table(d, ['Tiket', 'Tanggal', 'Cabang', 'Item', 'Status', 'Nilai'], rq.slice(0, 60).map(x => [x.id, x.submissionDate, x.branch, (x.items || []).length, x.status, R(rt(x))]));
      para(d, `Total nilai pengajuan bulan ini: ${R(rq.reduce((s, x) => s + rt(x), 0))}`);
      const ic = (AM.incidents || []).filter(x => (!br || x.branch === br) && inMonth(x.date, ym));
      heading(d, `5. Aset rusak / hilang bulan ini (${ic.length})`); table(d, ['Tanggal', 'Aset', 'Cabang', 'Qty', 'Jenis', 'Kerugian', 'Ganti rugi'], ic.map(x => [x.date, x.name, x.branch || '-', x.qty, ((KIND[x.kind] || [])[1]) || x.kind, R(x.loss), R(x.comp)]));
      const ln = AM.loans.filter(l => inMonth(l.date, ym) || inMonth(l.returnedAt, ym)).filter(l => { const a = find(l.assetId); return !br || (a && a.branch === br); });
      heading(d, `6. Peminjaman aset (${ln.length} aktivitas, ${overdue().length} lewat batas saat ini)`); table(d, ['Aset', 'Peminjam', 'Qty', 'Pinjam', 'Kembali'], ln.slice(0, 60).map(l => [(find(l.assetId) || {}).name || l.assetId, l.name, l.qty, l.date, l.returnedAt || 'belum']));
      const op = window.OPN ? Object.values(OPN.idx).filter(s => !s.deleted && s.status === 'final' && inMonth(s.date, ym) && (!br || s.branch === br)) : [];
      heading(d, `7. Stock opname bulan ini (${op.length})`); table(d, ['Cabang', 'Tanggal', 'Oleh', 'Item dihitung', 'Unit kurang', 'Unit lebih', 'Nilai kekurangan'], op.map(s => { const m = s.sum || {}; return [s.branch, s.date, s.by, `${m.done || 0}/${m.total || 0}`, m.shortQty || 0, m.overQty || 0, R(m.shortVal || 0)]; }));
      finish(d, `laporan_bulanan_${ym}${br ? '_' + br.replace(/\W+/g, '_') : ''}.pdf`); Swal.close();
    } catch (e) { console.error(e); pdfErr(e); }
  };

  BKP.opnamePdf = async function (s) {
    busy('Membuat PDF...');
    try {
      const st = OPN.stats(s), d = await newDoc(`Berita Acara Stock Opname - ${s.branch}`, `${s.id} · ${s.date} · dihitung ${s.by}${s.cat ? ' · kategori ' + s.cat : ''}`, false);
      heading(d, 'Ringkasan'); table(d, ['Keterangan', 'Nilai'], [['Item dihitung', `${st.done} dari ${st.total}`], ['Sesuai', st.ok], ['Kurang (unit / item)', `${st.shortQty} / ${st.short}`], ['Lebih (unit / item)', `${st.overQty} / ${st.over}`], ['Nilai kekurangan', R(st.shortVal)], ['Nilai kelebihan', R(st.overVal)], ['Barang tidak terdaftar (unit)', st.extraQty]]);
      const diffs = Object.entries(s.lines).filter(([, l]) => l.cnt != null && l.cnt !== l.e);
      heading(d, 'Rincian selisih'); table(d, ['ID', 'Nama', 'Sistem', 'Fisik', 'Selisih', 'Nilai', 'Catatan'], diffs.map(([id, l]) => [id, l.n, l.e, l.cnt, (l.cnt - l.e > 0 ? '+' : '') + (l.cnt - l.e), R(Math.abs(l.cnt - l.e) * (l.p || 0)), l.note || '']));
      const ex = Object.values(s.extra || {}).filter(x => !x.removed); if (ex.length) { heading(d, 'Barang ditemukan, belum terdaftar'); table(d, ['Nama', 'Jumlah', 'Catatan'], ex.map(x => [x.name, x.qty, x.note || ''])); }
      if (d.y > d.internal.pageSize.getHeight() - 140) { d.addPage(); d.y = 60; }
      d.setFontSize(9); d.setTextColor(60, 60, 60); d.text('Petugas hitung', 70, d.y + 20); d.text('Kepala cabang / saksi', 250, d.y + 20); d.text('GA Manager', 440, d.y + 20); d.line(60, d.y + 80, 160, d.y + 80); d.line(240, d.y + 80, 360, d.y + 80); d.line(430, d.y + 80, 530, d.y + 80);
      finish(d, `opname_${s.branch.replace(/\W+/g, '_')}_${s.date}.pdf`); Swal.close();
    } catch (e) { console.error(e); pdfErr(e); }
  };

  /* ====================== TAMPILAN ====================== */
  BKP.render = function () {
    const v = $('view-abak'); if (!v || !isGA()) return;
    const last = Number(localStorage.getItem(LAST) || 0), ago = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const bt = 'modern-button text-xs font-bold px-4 py-2.5 border ', pri = bt + 'bg-dobah-400 text-cocoa-950 border-dobah-400', sec = bt + 'bg-cocoa-800 text-dobah-200 border-white/10';
    v.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="glass-panel p-5"><h3 class="text-sm font-bold text-white mb-1"><i class="fa-solid fa-database text-dobah-400 mr-2"></i>Backup &amp; Restore</h3>
        <p class="text-[11px] text-dobah-200/70 mb-3">Backup terakhir: <b class="${ago === null || ago > 30 ? 'text-rose-400' : 'text-emerald-400'}">${ago === null ? 'belum pernah dari perangkat ini' : ago === 0 ? 'hari ini' : ago + ' hari lalu'}</b>. Disarankan sebulan sekali, simpan file di tempat terpisah.</p>
        <div class="flex flex-wrap gap-2"><button onclick="BKP.backup()" class="${pri}"><i class="fa-solid fa-download mr-1"></i>Unduh Backup</button><button onclick="BKP.restore()" class="${sec} text-rose-300"><i class="fa-solid fa-cloud-arrow-up mr-1"></i>Pulihkan dari File</button></div>
        <p class="text-[11px] text-dobah-200/50 mt-3">Akun login (Firebase Authentication) tidak ikut di backup. Kelola akun lewat Master Data.</p></div>
      <div class="glass-panel p-5"><h3 class="text-sm font-bold text-white mb-1"><i class="fa-solid fa-print text-dobah-400 mr-2"></i>Laporan</h3>
        <p class="text-[11px] text-dobah-200/70 mb-3">PDF dibuat di browser. Pertama kali dipakai butuh internet untuk memuat pustaka PDF.</p>
        <div class="flex flex-wrap gap-2"><button onclick="BKP.monthly()" class="${pri}"><i class="fa-solid fa-file-contract mr-1"></i>Laporan Bulanan</button><button onclick="BKP.branchRecapPdf()" class="${sec}"><i class="fa-solid fa-map-location-dot mr-1"></i>Rekap Cabang (PDF)</button><button onclick="BKP.branchRecapCsv()" class="${sec}"><i class="fa-solid fa-file-csv mr-1"></i>Rekap Cabang (CSV)</button></div></div></div>
      <div class="glass-panel p-5 text-xs text-dobah-200/80"><b class="text-white">Yang tersimpan sekarang:</b> ${AM.assets.length} aset · ${(window.ATT ? ATT.count() : 0)} lampiran · ${AM.loans.length} peminjaman · ${AM.incidents.length} insiden · ${(appState.requests || []).length} pengajuan.</div>`;
  };

  /* ---------- pengingat backup bulanan (GA) ---------- */
  function remind() {
    if (!isGA() || !AM.loaded || !window.db) return; const st = nload(); if (!st) return; const last = Number(localStorage.getItem(LAST) || 0);
    if (last && Date.now() - last < 30 * 864e5) return; NC.fresh = [];
    add({ key: 'bk|' + ymNow(), type: 'imp', level: 'info', tab: 'abak', title: 'Waktunya backup bulanan', msg: last ? `Backup terakhir ${Math.floor((Date.now() - last) / 864e5)} hari lalu.` : 'Belum ada backup dari perangkat ini.' });
    if (NC.fresh.length) { nsave(); ui(); announce(NC.fresh); }
  }
  const _scan = NC.scan; NC.scan = function () { _scan.apply(this, arguments); try { remind(); } catch (e) { console.error(e); } };

  GAX.regTab('abak', { title: 'Backup & Laporan', render: () => BKP.render(), gaOnly: true });
})();
