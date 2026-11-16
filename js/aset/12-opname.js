/* Modul Aset: Stock Opname / audit fisik per cabang.
   Dimuat setelah 11-notifications.js. Dibungkus IIFE supaya tidak bentrok dengan nama global modul lain.

   Penyimpanan:
   - settings/opname_index  -> { items: { [id]: ringkasan sesi } }       (daftar sesi)
   - settings/opname_<id>   -> satu sesi lengkap, baris hitungan berupa MAP { lines: { [assetId]: {...} } }
   Baris berupa map dan ditulis dengan setDoc(..., {merge:true}) supaya dua petugas yang menghitung barang
   berbeda di sesi yang sama tidak saling menimpa. Semua perubahan ditulis dulu ke localStorage, jadi
   tetap aman kalau sinyal toko jelek; kirim ke cloud berjalan di latar belakang. */

/* ===== helper bersama untuk modul fitur baru (12..16) ===== */
window.GAX = (() => {
  const extraGA = [];
  function regTab(id, { title, render, gaOnly }) {
    if (!TABS.includes(id)) TABS.push(id);
    TT[id] = title;
    R[id] = render;
    if (gaOnly) { GA_ONLY.push(id); extraGA.push(id); }
  }
  // Sembunyikan menu khusus GA untuk Staff Store (mengikuti pola 10-integration.js)
  const prev = window.checkUserSession;
  window.checkUserSession = function () {
    prev.apply(this, arguments);
    const st = (user() || {}).role === 'Staff Store';
    extraGA.forEach(x => { const b = $('tab-' + x); if (b) b.style.display = st ? 'none' : 'flex'; });
  };
  const csvCell = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  function download(name, blob) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }
  const csv = (name, rows) => download(name, new Blob(['\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const stamp = () => new Date().toISOString().slice(0, 10);
  const branchesAll = () => [...new Set([...(appState.branches || []), ...AM.assets.map(a => a.branch)])].filter(Boolean);
  const canAllBranches = () => isGA() || ((user() || {}).branches || []).includes('ALL');
  const canBranch = b => canAllBranches() || ((user() || {}).branches || []).includes(b);
  const myBranchList = () => canAllBranches() ? branchesAll() : ((user() || {}).branches || []).filter(b => b !== 'ALL');
  return { regTab, csv, download, stamp, branchesAll, canAllBranches, canBranch, myBranchList };
})();

(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const OPN = window.OPN = { idx: {}, cur: null, view: 'list', f: { q: '', mode: 'all' }, loaded: false };
  const LSI = 'ga_opn_idx', LSS = id => 'ga_opn_s_' + id, DOC_IDX = 'opname_index', sdoc = id => 'opname_' + id;
  const COND = { Good: 'Baik', Maintenance: 'Maintenance', Broken: 'Rusak' };
  const lget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage penuh', e); } };
  const nowStr = () => new Date().toLocaleString('id-ID');
  const who = () => (user() || {}).name || 'System';

  /* ---------- cloud (tidak pernah ditunggu oleh UI) ---------- */
  function cloudSet(docId, data) {
    if (!window.db) return Promise.resolve(false);
    const { setDoc, doc } = window.fbDeps;
    return setDoc(doc(window.db, 'settings', docId), data, { merge: true }).then(() => true).catch(e => { console.warn('Opname cloud:', e.code || e); return false; });
  }
  async function cloudGet(docId) {
    if (!window.db) return null;
    try { const { getDoc, doc } = window.fbDeps; const s = await getDoc(doc(window.db, 'settings', docId)); return s.exists() ? s.data() : null; } catch (e) { return null; }
  }
  const timers = {};
  function debounce(k, fn, ms) { clearTimeout(timers[k]); timers[k] = setTimeout(fn, ms); }

  /* ---------- indeks sesi ---------- */
  const visibleIdx = () => Object.values(OPN.idx).filter(s => !s.deleted && GAX.canBranch(s.branch)).sort((a, b) => b.createdAt - a.createdAt);
  function summarize(s) {
    const L = Object.values(s.lines || {}), counted = L.filter(l => l.cnt != null).length;
    return { id: s.id, branch: s.branch, cat: s.cat || '', date: s.date, by: s.by, status: s.status, createdAt: s.createdAt, total: L.length, counted, finalizedAt: s.finalizedAt || 0, sum: s.sum || null, deleted: !!s.deleted };
  }
  function putIdx(sum) { OPN.idx[sum.id] = sum; lset(LSI, OPN.idx); cloudSet(DOC_IDX, { items: { [sum.id]: sum } }); }
  async function loadIdx(render) {
    if (!OPN.loaded) { OPN.idx = lget(LSI) || {}; OPN.loaded = true; }
    if (render) renderActive();
    const d = await cloudGet(DOC_IDX);
    if (d && d.items) {
      Object.keys(d.items).forEach(k => { const c = OPN.idx[k], r = d.items[k]; if (!c || (r.finalizedAt || 0) >= (c.finalizedAt || 0) && (r.counted || 0) >= (c.counted || 0) || r.deleted) OPN.idx[k] = r; });
      lset(LSI, OPN.idx);
      if (render) renderActive();
    }
  }
  const renderActive = () => { if (appState.activeTab === 'aopn') OPN.render(); };

  /* ---------- sesi ---------- */
  async function loadSession(id) {
    let s = lget(LSS(id));
    const r = await cloudGet(sdoc(id));
    if (r) s = mergeSession(s, r);
    if (s) lset(LSS(id), s);
    return s;
  }
  // gabung per baris berdasarkan waktu ubah terbaru
  function mergeSession(a, b) {
    if (!a) return b; if (!b) return a;
    const out = { ...a, ...b, lines: { ...(a.lines || {}) }, extra: { ...(a.extra || {}) } };
    for (const k of Object.keys(b.lines || {})) { const x = out.lines[k], y = b.lines[k]; if (!x || (y.ts || 0) >= (x.ts || 0)) out.lines[k] = y; }
    for (const k of Object.keys(b.extra || {})) { const x = out.extra[k], y = b.extra[k]; if (!x || (y.ts || 0) >= (x.ts || 0)) out.extra[k] = y; }
    if (a.status === 'final' && b.status !== 'final') out.status = 'final';
    return out;
  }
  function watch(id) {
    unwatch();
    if (!window.db) return;
    try {
      const { onSnapshot, doc } = window.fbDeps;
      OPN.un = onSnapshot(doc(window.db, 'settings', sdoc(id)), snap => {
        if (!snap.exists() || (snap.metadata && snap.metadata.hasPendingWrites) || !OPN.cur || OPN.cur.id !== id) return;
        OPN.cur = mergeSession(OPN.cur, snap.data()); lset(LSS(id), OPN.cur);
        const ae = document.activeElement;
        if (!(ae && ae.closest && ae.closest('#view-aopn') && /INPUT|SELECT|TEXTAREA/.test(ae.tagName))) OPN.render();
      }, () => {});
    } catch (e) { console.warn(e); }
  }
  function unwatch() { if (OPN.un) { try { OPN.un(); } catch (e) {} OPN.un = null; } }

  const persistLine = (id) => {
    const s = OPN.cur; if (!s) return;
    lset(LSS(s.id), s);
    debounce('l' + id, () => cloudSet(sdoc(s.id), { lines: { [id]: s.lines[id] } }), 400);
    debounce('i' + s.id, () => putIdx(summarize(s)), 1500);
  };
  const persistExtra = (id) => {
    const s = OPN.cur; lset(LSS(s.id), s);
    cloudSet(sdoc(s.id), { extra: { [id]: s.extra[id] } });
    debounce('i' + s.id, () => putIdx(summarize(s)), 1500);
  };

  /* ---------- memulai sesi ---------- */
  OPN.start = async function () {
    const brs = GAX.myBranchList();
    if (!brs.length) return Swal.fire({ title: 'Belum ada cabang', text: 'Akun ini belum punya cabang untuk di-opname.', icon: 'info', ...SW });
    const cats = [...new Set(AM.assets.map(a => a.category).filter(Boolean))];
    const r = await ask('Mulai Stock Opname', [
      { k: 'branch', l: 'Cabang yang dicek', opts: brs.map(b => [b, b]) },
      { k: 'cat', l: 'Cakupan', opts: [['', 'Semua kategori'], ...cats.map(c => [c, 'Hanya kategori: ' + c])] }
    ], 'Mulai');
    if (!r) return;
    const dup = visibleIdx().find(s => s.branch === r.branch && s.status === 'draft' && (s.cat || '') === r.cat);
    if (dup) { const go = await confirmBox('Sudah ada opname berjalan', `Opname ${r.branch} yang belum selesai sudah ada (dibuat ${dup.by}). Lanjutkan sesi itu?`); if (go) return OPN.open(dup.id); return; }
    const assets = AM.assets.filter(a => a.branch === r.branch && !dead(a) && (!r.cat || a.category === r.cat) && q(a) - onLoan(a) > 0);
    if (!assets.length) return Swal.fire({ title: 'Tidak ada aset', text: 'Tidak ada aset aktif di cabang/kategori ini.', icon: 'info', ...SW });
    if (assets.length > 3000) return Swal.fire({ title: 'Terlalu banyak baris', text: `${assets.length} aset sekaligus terlalu besar untuk satu sesi. Pilih satu kategori saja.`, icon: 'warning', ...SW });
    const lines = {};
    assets.forEach(a => { lines[a.id] = { n: a.name, c: a.category || '', e: q(a) - onLoan(a), p: a.price || 0, ol: onLoan(a), cnt: null, cond: a.status === 'Good' ? 'Good' : a.status, note: '', ts: 0, by: '' }; });
    const s = { id: 'OPN-' + Date.now().toString(36).toUpperCase(), branch: r.branch, cat: r.cat, date: today(), by: who(), byId: (user() || {}).id || '', status: 'draft', createdAt: Date.now(), lines, extra: {} };
    lset(LSS(s.id), s);
    putIdx(summarize(s));
    if (window.db) { const { setDoc, doc } = window.fbDeps; setDoc(doc(window.db, 'settings', sdoc(s.id)), s).catch(e => console.warn(e)); }
    OPN.open(s.id, s);
  };

  OPN.open = async function (id, pre) {
    OPN.view = 'count'; OPN.f = { q: '', mode: 'all' };
    OPN.cur = pre || lget(LSS(id)); OPN.render();
    const s = await loadSession(id); if (!s) { OPN.view = 'list'; OPN.cur = null; return OPN.render(); }
    OPN.cur = s; OPN.view = s.status === 'final' ? 'result' : 'count';
    if (s.status !== 'final') watch(id);
    OPN.render();
  };
  OPN.back = function () { unwatch(); OPN.view = 'list'; OPN.cur = null; OPN.render(); };

  /* ---------- hitung ---------- */
  const diffOf = l => l.cnt == null ? null : l.cnt - l.e;
  function setLine(id, patch) {
    const s = OPN.cur; if (!s || s.status === 'final') return; const l = s.lines[id]; if (!l) return;
    Object.assign(l, patch, { ts: Date.now(), by: who() });
    persistLine(id); updRow(id); updHead();
  }
  OPN.setCnt = (el) => { const id = el.closest('[data-id]').dataset.id; const v = el.value === '' ? null : Math.max(0, parseInt(el.value) || 0); setLine(id, { cnt: v }); };
  OPN.step = (el, d) => { const id = el.closest('[data-id]').dataset.id, l = OPN.cur.lines[id]; setLine(id, { cnt: Math.max(0, (l.cnt == null ? (d > 0 ? 0 : 1) : l.cnt) + d) }); };
  OPN.match = (el) => { const id = el.closest('[data-id]').dataset.id; setLine(id, { cnt: OPN.cur.lines[id].e }); };
  OPN.setCond = (el) => { const id = el.closest('[data-id]').dataset.id; setLine(id, { cond: el.value }); };
  OPN.setNote = (el) => { const id = el.closest('[data-id]').dataset.id; const l = OPN.cur.lines[id]; l.note = el.value.trim().slice(0, 200); l.ts = Date.now(); l.by = who(); persistLine(id); };

  function rowHTML(id, l) {
    const d = diffOf(l), cls = d == null ? '' : d < 0 ? 'ga-diff-neg' : d > 0 ? 'ga-diff-pos' : 'ga-done';
    const badgeD = d == null ? '' : d === 0 ? '<span class="text-emerald-400 font-bold">Sesuai</span>' : `<span class="${d < 0 ? 'text-rose-400' : 'text-amber-400'} font-bold">${d > 0 ? 'Lebih ' : 'Kurang '}${Math.abs(d)}</span>`;
    return `<div class="ga-count-row ${cls}" data-id="${esc(id)}"><div class="min-w-0"><div class="font-bold text-white text-sm break-words">${esc(l.n)}</div>
      <div class="text-[11px] text-dobah-200/60">${esc(id)}${l.c ? ' · ' + esc(l.c) : ''} · Sistem: <b class="text-dobah-200">${l.e}</b>${l.ol ? ` <span class="text-amber-400">(+${l.ol} dipinjam)</span>` : ''} ${badgeD ? '· ' + badgeD : ''}</div>
      <div class="flex gap-2 mt-2"><select onchange="OPN.setCond(this)" class="glass-input px-2 py-1.5 text-[11px] font-semibold">${Object.entries(COND).map(([k, v]) => `<option value="${k}" ${l.cond === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input value="${esc(l.note || '')}" onchange="OPN.setNote(this)" placeholder="Catatan (opsional)" class="glass-input px-2 py-1.5 text-[11px] flex-1 min-w-0"></div></div>
      <div class="flex flex-col items-end gap-1.5"><div class="ga-stepper"><button type="button" onclick="OPN.step(this,-1)">&minus;</button><input type="number" inputmode="numeric" min="0" value="${l.cnt == null ? '' : l.cnt}" placeholder="—" onchange="OPN.setCnt(this)"><button type="button" onclick="OPN.step(this,1)">+</button></div>
      <button type="button" onclick="OPN.match(this)" class="text-[11px] font-bold text-dobah-300 underline">Sesuai sistem</button></div></div>`;
  }
  function updRow(id) {
    const el = document.querySelector(`#opnRows [data-id="${CSS.escape(id)}"]`); if (!el) return;
    const keep = document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number';
    if (keep) { el.className = rowHTML(id, OPN.cur.lines[id]).match(/class="([^"]*)"/)[1]; return; } // jangan ganggu input yang sedang diketik
    el.outerHTML = rowHTML(id, OPN.cur.lines[id]);
  }
  function stats(s) {
    const L = Object.entries(s.lines || {}), done = L.filter(([, l]) => l.cnt != null);
    return { total: L.length, done: done.length, ok: done.filter(([, l]) => l.cnt === l.e).length, short: done.filter(([, l]) => l.cnt < l.e).length, over: done.filter(([, l]) => l.cnt > l.e).length,
      shortQty: done.reduce((n, [, l]) => n + Math.max(0, l.e - l.cnt), 0), overQty: done.reduce((n, [, l]) => n + Math.max(0, l.cnt - l.e), 0),
      shortVal: done.reduce((n, [, l]) => n + Math.max(0, l.e - l.cnt) * (l.p || 0), 0), overVal: done.reduce((n, [, l]) => n + Math.max(0, l.cnt - l.e) * (l.p || 0), 0),
      extraQty: Object.values(s.extra || {}).reduce((n, x) => n + (x.qty || 0), 0) };
  }
  OPN.stats = stats;
  function updHead() {
    const s = OPN.cur, st = stats(s), p = st.total ? Math.round(st.done / st.total * 100) : 0, h = $('opnHead'); if (!h) return;
    h.innerHTML = `<div class="flex justify-between text-[11px] font-mono text-dobah-200 mb-1"><span>Progres ${st.done}/${st.total}</span><span class="font-bold text-dobah-400">${p}%</span></div><div class="ga-bar"><span style="width:${p}%"></span></div>
      <div class="flex flex-wrap gap-2 mt-3 text-[11px]"><span class="text-emerald-400 font-bold">${st.ok} sesuai</span><span class="text-rose-400 font-bold">${st.short} kurang</span><span class="text-amber-400 font-bold">${st.over} lebih</span><span class="text-dobah-200/60">${st.total - st.done} belum dihitung</span></div>`;
  }
  OPN.filter = (k, v) => { OPN.f[k] = v; if (k === 'mode') OPN.render(); else listRows(); };
  function listRows() {
    const s = OPN.cur, f = OPN.f, qq = f.q.toLowerCase();
    const L = Object.entries(s.lines).filter(([id, l]) => (!qq || l.n.toLowerCase().includes(qq) || id.toLowerCase().includes(qq)) &&
      (f.mode === 'all' || (f.mode === 'todo' && l.cnt == null) || (f.mode === 'diff' && l.cnt != null && l.cnt !== l.e) || (f.mode === 'ok' && l.cnt != null && l.cnt === l.e)));
    L.sort((a, b) => a[1].n.localeCompare(b[1].n));
    const box = $('opnRows'); if (!box) return;
    box.innerHTML = L.length ? L.slice(0, 300).map(([id, l]) => rowHTML(id, l)).join('') + (L.length > 300 ? `<p class="text-center text-[11px] text-dobah-200/60 py-2">Menampilkan 300 dari ${L.length}. Gunakan pencarian untuk mempersempit.</p>` : '') : '<p class="text-center italic text-dobah-200/50 py-8">Tidak ada baris untuk filter ini.</p>';
  }

  OPN.addExtra = async function () {
    const s = OPN.cur; if (!s || s.status === 'final') return;
    const r = await ask('Barang ditemukan, belum terdaftar', [{ k: 'name', l: 'Nama barang', req: 1 }, { k: 'qty', l: 'Jumlah', t: 'number', v: 1 }, { k: 'note', l: 'Catatan / lokasi (opsional)' }], 'Tambah');
    if (!r) return;
    const id = 'X' + Date.now().toString(36);
    s.extra[id] = { name: r.name, qty: Math.max(1, parseInt(r.qty) || 1), note: r.note, ts: Date.now(), by: who() };
    persistExtra(id); OPN.render();
  };
  OPN.delExtra = function (id) { const s = OPN.cur; if (!s || s.status === 'final') return; s.extra[id].qty = 0; s.extra[id].ts = Date.now(); s.extra[id].removed = true; persistExtra(id); OPN.render(); };

  /* ---------- finalisasi ---------- */
  OPN.finish = async function () {
    const s = OPN.cur; if (!s || s.status === 'final') return;
    const st = stats(s), todo = st.total - st.done;
    const ok = await confirmBox('Selesaikan opname?', `${st.done} dari ${st.total} item sudah dihitung.${todo ? ` ${todo} item belum dihitung akan dicatat “tidak dicek” dan TIDAK dianggap selisih.` : ''} Setelah selesai, hasil tidak bisa diubah.`);
    if (!ok) return;
    s.status = 'final'; s.finalizedAt = Date.now(); s.finalizedBy = who(); s.sum = stats(s);
    lset(LSS(s.id), s);
    if (window.db) { const { setDoc, doc } = window.fbDeps; setDoc(doc(window.db, 'settings', sdoc(s.id)), s, { merge: true }).catch(e => console.warn(e)); }
    putIdx(summarize(s)); unwatch();
    // Tulis ke Riwayat aset yang selisih / kondisinya tidak baik
    let n = 0; const tgl = new Date().toLocaleDateString('id-ID');
    Object.entries(s.lines).forEach(([id, l]) => {
      if (l.cnt == null) return; const a = find(id); if (!a) return; const d = l.cnt - l.e;
      if (d !== 0 || l.cond !== 'Good') { hist(a, `Stock opname ${tgl} (${s.id}): sistem ${l.e}, fisik ${l.cnt}${d ? ` (selisih ${d > 0 ? '+' : ''}${d})` : ''}, kondisi ${COND[l.cond] || l.cond}${l.note ? ' — ' + l.note : ''}`); n++; }
    });
    if (n) save(true);
    OPN.view = 'result'; OPN.render();
  };

  OPN.remove = async function (id) {
    const sum = OPN.idx[id]; if (!sum) return;
    if (!(isGA() || sum.status === 'draft')) return deny();
    if (!(await confirmBox('Hapus sesi opname?', 'Sesi dan hasil hitungannya akan dihapus.'))) return;
    sum.deleted = true; putIdx(sum); try { localStorage.removeItem(LSS(id)); } catch (e) {}
    if (window.db) { const { deleteDoc, doc } = window.fbDeps; deleteDoc(doc(window.db, 'settings', sdoc(id))).catch(() => {}); }
    OPN.render();
  };

  /* ---------- ekspor ---------- */
  OPN.csv = function (id) {
    const s = (OPN.cur && OPN.cur.id === id) ? OPN.cur : lget(LSS(id)); if (!s) return;
    const rows = [['ID Aset', 'Nama', 'Kategori', 'Qty Sistem', 'Qty Fisik', 'Selisih', 'Nilai Selisih (Rp)', 'Kondisi', 'Catatan', 'Dihitung oleh']];
    Object.entries(s.lines).forEach(([aid, l]) => { const d = diffOf(l); rows.push([aid, l.n, l.c, l.e, l.cnt == null ? 'Belum dihitung' : l.cnt, d == null ? '' : d, d == null ? '' : d * (l.p || 0), COND[l.cond] || l.cond, l.note, l.by]); });
    Object.values(s.extra || {}).filter(x => !x.removed).forEach(x => rows.push(['(tidak terdaftar)', x.name, '', 0, x.qty, '+' + x.qty, '', '', x.note, x.by]));
    GAX.csv(`opname_${s.branch.replace(/\W+/g, '_')}_${s.date}.csv`, rows);
  };
  OPN.pdf = function (id) { const s = (OPN.cur && OPN.cur.id === id) ? OPN.cur : lget(LSS(id)); if (s && window.BKP) BKP.opnamePdf(s); };

  /* ---------- tampilan ---------- */
  function listView() {
    const L = visibleIdx(), run = L.filter(s => s.status === 'draft'), fin = L.filter(s => s.status === 'final');
    const monthShort = fin.filter(s => (s.finalizedAt || 0) > Date.now() - 30 * 864e5).reduce((n, s) => n + ((s.sum || {}).shortQty || 0), 0);
    const rows = L.map(s => {
      const p = s.total ? Math.round(s.counted / s.total * 100) : 0, sm = s.sum || {};
      return `<tr class="hover:bg-white/[0.02]"><td class="p-4 font-bold text-white">${esc(s.branch)}${sub(esc(s.id) + (s.cat ? ' · ' + esc(s.cat) : ''))}</td><td class="p-4">${esc(s.date)}${sub(esc(s.by))}</td>
        <td class="p-4">${s.status === 'final' ? `<span class="text-emerald-400 font-bold">Selesai</span>${sub('Kurang ' + (sm.shortQty || 0) + ' · Lebih ' + (sm.overQty || 0) + ' unit')}` : `<span class="text-amber-400 font-bold">Berjalan</span>${sub(s.counted + '/' + s.total + ' (' + p + '%)')}`}</td>
        <td class="p-4 whitespace-nowrap">${btn(`OPN.open('${s.id}')`, s.status === 'final' ? 'fa-list-check' : 'fa-pen-to-square', s.status === 'final' ? 'Lihat hasil' : 'Lanjutkan hitung')}${(isGA() || s.status === 'draft') ? btn(`OPN.remove('${s.id}')`, 'fa-trash-can', 'Hapus', 'text-rose-400') : ''}</td></tr>`;
    }).join('');
    return `<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">${kpi('Opname Berjalan', run.length, 'fa-list-check', 'amber')}${kpi('Opname Selesai', fin.length, 'fa-circle-check', 'emerald')}${kpi('Unit Kurang (30 hari)', monthShort, 'fa-triangle-exclamation', 'rose')}</div>
      <div class="flex flex-wrap justify-between items-center gap-3"><p class="text-xs text-dobah-200/70 max-w-xl">Hitung fisik aset per cabang, bandingkan dengan data sistem, lalu lihat selisihnya. Hasil hitungan tersimpan di perangkat dan dikirim otomatis saat ada sinyal.</p>
      <button onclick="OPN.start()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-5 py-2.5"><i class="fa-solid fa-plus mr-1"></i>Mulai Opname</button></div>`
      + tbl(th('Cabang', 'Tanggal / Oleh', 'Status', 'Aksi'), rows, 'Belum ada sesi opname.');
  }
  function countView() {
    const s = OPN.cur; if (!s) return '<p class="text-dobah-200/60 p-6">Memuat...</p>';
    const f = OPN.f, ch = [['all', 'Semua'], ['todo', 'Belum dihitung'], ['diff', 'Selisih'], ['ok', 'Sesuai']];
    const ex = Object.entries(s.extra || {}).filter(([, x]) => !x.removed);
    return `<div class="flex items-center gap-3"><button onclick="OPN.back()" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-3 py-2 border border-white/10"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="min-w-0"><h3 class="text-white font-bold text-sm truncate">Opname ${esc(s.branch)}${s.cat ? ' · ' + esc(s.cat) : ''}</h3><p class="text-[11px] text-dobah-200/60">${esc(s.id)} · ${esc(s.date)} · ${esc(s.by)}</p></div></div>
      <div class="glass-panel p-4" id="opnHead"></div>
      <div class="flex flex-wrap gap-2 items-center"><input value="${esc(f.q)}" oninput="OPN.filter('q',this.value)" placeholder="Cari nama / ID aset..." class="glass-input px-3.5 py-2 text-xs font-semibold flex-1 min-w-[160px]">
        ${ch.map(([k, l]) => `<button onclick="OPN.filter('mode','${k}')" class="ga-chip ${f.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="opnRows" class="space-y-2"></div>
      ${ex.length ? `<div class="glass-panel p-4"><h4 class="text-xs font-bold text-white mb-2">Barang tidak terdaftar</h4><div class="space-y-1.5 text-xs">${ex.map(([id, x]) => `<div class="ga-file-row"><span><b class="text-white">${esc(x.name)}</b> × ${x.qty}${x.note ? sub(esc(x.note)) : ''}</span><button onclick="OPN.delExtra('${id}')" class="text-rose-400 text-[11px] font-bold">Hapus</button></div>`).join('')}</div></div>` : ''}
      <div class="ga-sticky-foot flex flex-wrap gap-2 justify-end"><button onclick="OPN.addExtra()" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-4 py-2.5 border border-white/10"><i class="fa-solid fa-plus mr-1"></i>Barang tak terdaftar</button>
        <button onclick="OPN.finish()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-5 py-2.5"><i class="fa-solid fa-flag-checkered mr-1"></i>Selesaikan Opname</button></div>`;
  }
  function resultView() {
    const s = OPN.cur; if (!s) return '<p class="text-dobah-200/60 p-6">Memuat...</p>';
    const st = stats(s), diffs = Object.entries(s.lines).filter(([, l]) => l.cnt != null && l.cnt !== l.e).sort((a, b) => Math.abs((b[1].cnt - b[1].e) * (b[1].p || 0)) - Math.abs((a[1].cnt - a[1].e) * (a[1].p || 0)));
    const bad = Object.entries(s.lines).filter(([, l]) => l.cnt != null && l.cond !== 'Good' && l.cnt === l.e);
    const ex = Object.values(s.extra || {}).filter(x => !x.removed);
    const rows = diffs.map(([id, l]) => { const d = l.cnt - l.e; return `<tr class="hover:bg-white/[0.02]"><td class="p-4 font-bold text-white">${esc(l.n)}${sub(esc(id) + (l.c ? ' · ' + esc(l.c) : ''))}${l.note ? sub(esc(l.note)) : ''}</td><td class="p-4 font-mono">${l.e}</td><td class="p-4 font-mono">${l.cnt}</td>
      <td class="p-4 font-mono font-bold ${d < 0 ? 'text-rose-400' : 'text-amber-400'}">${d > 0 ? '+' : ''}${d}</td><td class="p-4 font-mono">${rp(Math.abs(d) * (l.p || 0))}</td><td class="p-4">${esc(COND[l.cond] || l.cond)}</td>
      <td class="p-4 whitespace-nowrap">${isGA() && d < 0 ? btn(`AM.report('${esc(id).replace(/'/g, "\\'")}')`, 'fa-triangle-exclamation', 'Laporkan rusak / hilang', 'text-rose-400') : ''}</td></tr>`; }).join('');
    return `<div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3"><button onclick="OPN.back()" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-3 py-2 border border-white/10"><i class="fa-solid fa-chevron-left"></i></button>
      <div><h3 class="text-white font-bold text-sm">Hasil Opname ${esc(s.branch)}${s.cat ? ' · ' + esc(s.cat) : ''}</h3><p class="text-[11px] text-dobah-200/60">${esc(s.id)} · ${esc(s.date)} · dihitung ${esc(s.by)} · diselesaikan ${esc(s.finalizedBy || '-')}</p></div></div>
      <div class="flex gap-2"><button onclick="OPN.csv('${s.id}')" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-4 py-2 border border-white/10"><i class="fa-solid fa-file-csv mr-1"></i>CSV</button><button onclick="OPN.pdf('${s.id}')" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-4 py-2 border border-white/10"><i class="fa-solid fa-print mr-1"></i>PDF</button></div></div>
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">${kpi('Item Dihitung', st.done + '/' + st.total, 'fa-list-check')}${kpi('Sesuai', st.ok, 'fa-circle-check', 'emerald')}${kpi('Kurang (unit)', st.shortQty, 'fa-circle-xmark', 'rose')}${kpi('Lebih (unit)', st.overQty, 'fa-triangle-exclamation', 'amber')}${kpi('Nilai Kekurangan', rp(st.shortVal), 'fa-wallet', 'rose')}</div>`
      + tbl(th('Aset', 'Sistem', 'Fisik', 'Selisih', 'Nilai', 'Kondisi', 'Aksi'), rows, 'Tidak ada selisih. Semua item yang dihitung sesuai data sistem.')
      + (bad.length ? `<div class="glass-panel p-4 text-xs"><b class="text-white">Jumlah sesuai, tetapi kondisi tidak baik (${bad.length}):</b><br>${bad.map(([id, l]) => esc(l.n) + ' (' + esc(COND[l.cond] || l.cond) + ')').join(', ')}</div>` : '')
      + (ex.length ? `<div class="glass-panel p-4 text-xs"><b class="text-white">Barang ditemukan tetapi belum terdaftar (${ex.length}):</b><br>${ex.map(x => esc(x.name) + ' × ' + x.qty + (x.note ? ' — ' + esc(x.note) : '')).join('<br>')}</div>` : '')
      + (st.total - st.done ? `<p class="text-[11px] text-dobah-200/60">${st.total - st.done} item tidak dicek dan tidak dihitung sebagai selisih.</p>` : '');
  }
  OPN.render = function () {
    const v = $('view-aopn'); if (!v) return;
    if (!OPN.loaded) OPN.idx = lget(LSI) || {}, OPN.loaded = true;
    if (OPN.view === 'count') { v.innerHTML = countView(); if (OPN.cur) { updHead(); listRows(); } }
    else if (OPN.view === 'result') v.innerHTML = resultView();
    else v.innerHTML = listView();
  };

  /* ---------- notifikasi dalam aplikasi: opname selesai dengan kekurangan (GA) ---------- */
  OPN.notify = function () {
    if (!isGA() || !OPN.loaded) return; const st = nload(); if (!st) return; NC.fresh = [];
    visibleIdx().filter(s => s.status === 'final' && (s.finalizedAt || 0) > Date.now() - 7 * 864e5 && (s.sum || {}).shortQty > 0).forEach(s =>
      add({ key: 'opn|' + s.id, type: 'inc', level: 'warn', tab: 'aopn', title: `Opname ${s.branch}: ada kekurangan`, msg: `${s.sum.shortQty} unit kurang · ${s.sum.short} item · oleh ${s.by}` }));
    visibleIdx().filter(s => s.status === 'draft' && Date.now() - s.createdAt > 3 * 864e5).forEach(s =>
      add({ key: 'opd|' + s.id + '|' + ld(), type: 'inc', level: 'info', tab: 'aopn', title: `Opname ${s.branch} belum selesai`, msg: `Dimulai ${s.date} oleh ${s.by}` }));
    if (NC.fresh.length) { nsave(); ui(); announce(NC.fresh); }
  };
  const _scan = NC.scan; NC.scan = function () { _scan.apply(this, arguments); try { OPN.notify(); } catch (e) { console.error(e); } };

  GAX.regTab('aopn', { title: 'Stock Opname', render: () => { OPN.render(); loadIdx(true); } });
  window.addEventListener('profile-ready', () => loadIdx(false).then(() => OPN.notify()));
})();
