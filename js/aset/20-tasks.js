/* Modul Aset: Pengingat Pekerjaan (maintenance aset, sarana & prasarana, pembelian aset, inspeksi, perizinan, dll).
   Dimuat setelah 19-bills.js. Dibungkus IIFE supaya tidak bentrok dengan nama global modul lain.
   Tampilannya memakai kelas bl-* dari css/bills.css agar serasi dengan Pengingat Tagihan.

   Penyimpanan:
   - settings/tasks_v1 -> { items: { [id]: pekerjaan } }   (satu map; ditulis setDoc merge per pekerjaan)
   - localStorage 'ga_tasks_v1' sebagai cadangan lokal / saat offline

   Satu pekerjaan = satu pekerjaan berulang (mis. servis AC tiap 3 bulan) atau sekali jalan (mis. beli 10 laptop):
   { id, name, cat, branch, asset, pic, wa, prio: high|normal|low, est, recur: once|weekly|monthly|quarterly|semiannual|yearly,
     due: 'YYYY-MM-DD'  <- tenggat berikutnya yang BELUM dikerjakan,
     day: tanggal jangkar bulanan, remind: 1|3|7|14 hari sebelumnya, doing: sedang dikerjakan,
     log: [{ due, doneAt, cost, note, by }], done: true bila sekali-jalan sudah selesai, deleted, upd }
   Saat diselesaikan, pekerjaan berulang otomatis maju ke periode berikutnya. */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const TK = window.TK = { items: {}, loaded: false, f: { t: 'all', c: 'all', q: '' } };
  const LSK = 'ga_tasks_v1', DOC = 'tasks_v1';
  const CATS = ['Maintenance Aset', 'Sarana & Prasarana', 'Pembelian Aset', 'Inspeksi / Audit', 'Perizinan / Sertifikasi', 'Kebersihan & Keamanan', 'Lainnya'];
  const CI = { 'Maintenance Aset': 'fa-screwdriver-wrench', 'Sarana & Prasarana': 'fa-gears', 'Pembelian Aset': 'fa-cart-shopping', 'Inspeksi / Audit': 'fa-list-check',
    'Perizinan / Sertifikasi': 'fa-file-signature', 'Kebersihan & Keamanan': 'fa-key', 'Lainnya': 'fa-flag' };
  const RECUR = { once: 'Sekali jalan', weekly: 'Mingguan', monthly: 'Bulanan', quarterly: '3 bulanan', semiannual: '6 bulanan', yearly: 'Tahunan' };
  const STEP = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
  const PRIO = { high: 'Tinggi', normal: 'Sedang', low: 'Rendah' };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const pad = n => String(n).padStart(2, '0');
  const fd = d => d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '-';
  const lget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage penuh', e); } };
  const who = () => (user() || {}).name || 'System';
  const live = () => Object.values(TK.items).filter(t => !t.deleted);

  /* ---------- tanggal ---------- */
  // Tambah periode ke tenggat; untuk bulanan dst. tanggal jangkar dijaga (31 Jan -> 28 Feb -> 31 Mar)
  function addPeriod(due, recur, day) {
    const y0 = +due.slice(0, 4), m0 = +due.slice(5, 7) - 1, d0 = +due.slice(8, 10);
    if (recur === 'weekly') { const t = new Date(Date.UTC(y0, m0, d0 + 7)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
    const step = STEP[recur]; if (!step) return due;
    let y = y0, idx = m0 + step; y += Math.floor(idx / 12); idx %= 12;
    const dim = new Date(Date.UTC(y, idx + 1, 0)).getUTCDate();
    return `${y}-${pad(idx + 1)}-${pad(Math.min(day || d0, dim))}`;
  }
  TK.addPeriod = addPeriod;

  /* ---------- cloud (tidak pernah ditunggu oleh UI) ---------- */
  function cloudSet(data) {
    if (!window.db) return Promise.resolve(false);
    const { setDoc, doc } = window.fbDeps;
    return setDoc(doc(window.db, 'settings', DOC), data, { merge: true }).then(() => true).catch(e => { console.warn('Pekerjaan cloud:', e.code || e); return false; });
  }
  function put(t) { t.upd = Date.now(); TK.items[t.id] = t; lset(LSK, TK.items); cloudSet({ items: { [t.id]: t } }); }
  function merge(remote) {
    let ch = false;
    Object.keys(remote || {}).forEach(k => { const c = TK.items[k], r = remote[k]; if (!c || (r.upd || 0) >= (c.upd || 0)) { if (!c || (r.upd || 0) !== (c.upd || 0)) ch = true; TK.items[k] = r; } });
    if (ch) lset(LSK, TK.items);
    return ch;
  }
  function load() { if (!TK.loaded) { TK.items = lget(LSK) || {}; TK.loaded = true; } }
  function watch() {
    if (TK.sub || !window.db) return; TK.sub = true;
    try {
      const { onSnapshot, doc } = window.fbDeps;
      onSnapshot(doc(window.db, 'settings', DOC), snap => {
        if (!snap.exists() || (snap.metadata && snap.metadata.hasPendingWrites)) return;
        load(); if (merge((snap.data() || {}).items)) { renderActive(); try { TK.notify(); } catch (e) { console.error(e); } }
      }, () => {});
    } catch (e) { console.warn(e); }
  }
  const renderActive = () => { if (appState.activeTab === 'atsk') TK.render(); };

  /* ---------- status ---------- */
  function stat(t) { if (t.done) return 'done'; const d = days(t.due); return d < 0 ? 'late' : d <= (t.remind || 7) ? 'soon' : 'ok'; }
  function label(t) {
    const s = stat(t), d = days(t.due);
    return s === 'done' ? 'Selesai' : s === 'late' ? `Terlambat ${-d} hari` : d === 0 ? 'Tenggat hari ini' : `${d} hari lagi`;
  }
  const when = t => { const d = days(t.due); return d < 0 ? `${-d} hari terlambat` : d === 0 ? 'Hari ini' : `${d} hari lagi`; };
  const RIB = { late: 'Terlambat', soon: 'Segera Dikerjakan', done: 'Selesai' };

  /* ---------- tampilan ---------- */
  function card(t) {
    const s = stat(t), log = t.log || [], last = log[log.length - 1], act = [], id = t.id;
    const bt = (fn, cls, txt) => `<button type="button" class="bl-btn ${cls}" onclick="${fn}">${txt}</button>`;
    if (s === 'late' || s === 'soon') act.push(bt(`TK.finish('${id}')`, s === 'late' ? 'bl-btn-dark' : 'bl-btn-amber', 'Selesaikan'));
    if (s === 'late') act.push(bt(`TK.detail('${id}')`, 'bl-btn-ghost', 'Detail'));
    else if (s === 'soon') act.push(bt(`TK.remind('${id}')`, 'bl-btn-ghost', 'Kirim Pengingat'));
    else if (s === 'ok') act.push(bt(`TK.detail('${id}')`, 'bl-btn-ghost', 'Detail') + bt(`TK.remind('${id}')`, 'bl-btn-ghost', 'Kirim Pengingat'));
    else act.push(bt(`TK.detail('${id}')`, 'bl-btn-ghost', 'Detail'));
    const dateCol = t.done
      ? `<div class="bl-d"><span>Selesai</span><b>${fd(last ? last.doneAt : t.due)}</b></div>`
      : `<div class="bl-d"><span>Tenggat</span><b>${fd(t.due)}</b><small>${when(t)}</small></div>`;
    const chips = `<span class="bl-pri ${t.prio || 'normal'}"><i class="fa-solid fa-flag"></i>${PRIO[t.prio] || PRIO.normal}</span>${t.doing && !t.done ? '<span class="bl-pri doing"><i class="fa-solid fa-gears"></i>Dikerjakan</span>' : ''}`;
    act.push(`<span class="bl-tools">${s === 'soon' ? `<button type="button" class="bl-ic" onclick="TK.detail('${id}')" title="Lihat detail" aria-label="Lihat detail"><i class="fa-solid fa-circle-info"></i></button>` : ''}<button type="button" class="bl-ic" onclick="TK.edit('${id}')" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button></span>`);
    return `<article class="bl-card bl-click ${s === 'done' ? 'paid' : s}" onclick="if(!event.target.closest('button'))TK.detail('${id}')" title="Klik untuk lihat detail">${RIB[s] ? `<span class="bl-rib">${RIB[s]}</span>` : ''}
      <div class="bl-head"><span class="bl-ico" aria-hidden="true"><i class="fa-solid ${CI[t.cat] || CI.Lainnya}"></i></span><h3 class="bl-name" title="${esc(t.name)}">${esc(t.name)}</h3></div>
      <div class="bl-body"><div class="bl-who"><div>PIC: <b>${esc(t.pic || '-')}</b></div><div>Cabang: <b>${esc(t.branch || 'Umum')}</b></div>${t.asset ? `<div>Aset: <b>${esc(t.asset)}</b></div>` : ''}</div>
        <div class="bl-dates"><div class="bl-d"><span>Berulang</span><b>${RECUR[t.recur] || RECUR.once}</b></div>${dateCol}</div></div>
      <div class="bl-foot"><div class="bl-chips">${chips}</div><div class="bl-acts">${act.join('')}</div></div></article>`;
  }
  const rank = t => t.done ? 9 : ({ late: 0, soon: 1, ok: 2 })[stat(t)];
  const FL = { all: 'Semua pekerjaan', act: 'Belum selesai', late: 'Terlambat', soon: 'Segera dikerjakan', doing: 'Sedang dikerjakan', ok: 'Terjadwal', done: 'Selesai' };
  const match = (t, f) => (f.t === 'all' || (f.t === 'act' ? !t.done : f.t === 'doing' ? !!t.doing && !t.done : stat(t) === f.t)) && (f.c === 'all' || t.cat === f.c);
  function grid() {
    const el = $('tkGrid'); if (!el) return;
    const f = TK.f, qq = (f.q || '').toLowerCase();
    const L = live().filter(t => match(t, f) && (!qq || [t.name, t.cat, t.branch, t.asset, t.pic, t.note].join(' ').toLowerCase().includes(qq)))
      .sort((a, b) => rank(a) - rank(b) || String(a.due).localeCompare(String(b.due)));
    el.innerHTML = L.length ? L.map(card).join('') : `<div class="bl-empty"><div class="empty-donut"></div>${live().length ? 'Belum ada pekerjaan pada filter ini.' : 'Belum ada pekerjaan. Klik "Tambah Pekerjaan" untuk menjadwalkan maintenance, pembelian, atau inspeksi.'}</div>`;
  }
  const kcard = (l, v, ic, tone, k) => `<button type="button" class="bl-kpi t-${tone}${TK.f.t === k ? ' is-on' : ''}" onclick="TK.pick('${k}')" aria-pressed="${TK.f.t === k}" title="Klik untuk menampilkan">
    <span class="bl-kpi-top"><span class="bl-kpi-lbl">${l}</span><span class="bl-kpi-ico"><i class="fa-solid ${ic}"></i></span></span><span class="bl-kpi-num">${v}</span></button>`;
  TK.render = function () {
    const v = $('view-atsk'); if (!v) return; load();
    const A = live(), act = A.filter(t => !t.done), late = act.filter(t => stat(t) === 'late'), soon = act.filter(t => stat(t) === 'soon'), doing = act.filter(t => t.doing), f = TK.f,
      cnt = { all: A.length, act: act.length, late: late.length, soon: soon.length, doing: doing.length, ok: act.length - late.length - soon.length, done: A.length - act.length };
    const sel = Object.keys(FL).map(k => `<option value="${k}" ${f.t === k ? 'selected' : ''}>${FL[k]} (${cnt[k]})</option>`).join('');
    const csel = ['<option value="all">Semua kategori</option>'].concat(CATS.map(c => `<option value="${esc(c)}" ${f.c === c ? 'selected' : ''}>${esc(c)}</option>`)).join('');
    v.innerHTML = `<div class="bl-kpis">${kcard('Pekerjaan Aktif', act.length, 'fa-list-check', 'act', 'act')}${kcard('Terlambat', late.length, 'fa-triangle-exclamation', 'late', 'late')}${kcard('Segera Dikerjakan', soon.length, 'fa-hourglass-half', 'soon', 'soon')}${kcard('Sedang Dikerjakan', doing.length, 'fa-gears', 'sum', 'doing')}</div>
      <div id="tkBar" class="bl-bar"><select onchange="TK.tab(this.value)" class="bl-select" aria-label="Filter status">${sel}</select><select onchange="TK.cat(this.value)" class="bl-select" aria-label="Filter kategori">${csel}</select>
        <input type="search" placeholder="Cari pekerjaan / cabang / aset / PIC..." value="${esc(f.q)}" oninput="TK.q(this.value)" class="bl-search" aria-label="Cari pekerjaan">
        <button type="button" onclick="TK.csv()" class="bl-btn bl-btn-ghost"><i class="fa-solid fa-file-csv"></i>.CSV</button><button type="button" onclick="TK.add()" class="bl-btn bl-btn-amber"><i class="fa-solid fa-plus"></i>Tambah Pekerjaan</button></div>
      <div id="tkGrid" class="bl-grid"></div>`;
    grid();
  };
  TK.pick = k => { TK.f.t = TK.f.t === k ? 'all' : k; TK.render(); const c = $('tkBar'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  TK.tab = k => { TK.f.t = FL[k] ? k : 'all'; TK.render(); };
  TK.cat = k => { TK.f.c = CATS.includes(k) ? k : 'all'; TK.render(); };
  TK.q = v => { TK.f.q = v; grid(); };

  /* ---------- detail & kirim pengingat ---------- */
  TK.detail = function (id) {
    const t = TK.items[id]; if (!t) return;
    const s = stat(t), last = (t.log || []).slice(-1)[0], dd = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const bt = (fn, ic, txt, cls) => `<button type="button" class="bl-btn bl-btn-${cls || 'ghost'}" onclick="Swal.close();${fn}"><i class="fa-solid ${ic}"></i>${txt}</button>`;
    Swal.fire({ title: esc(t.name), width: 520, showConfirmButton: false, showCloseButton: true, ...SW,
      html: `<span class="bl-det-st ${s === 'done' ? 'paid' : s}">${label(t)}</span><dl class="bl-dl">${dd('Kategori', esc(t.cat || 'Lainnya'))}${dd('Cabang', esc(t.branch || 'Umum / Kantor Pusat'))}${t.asset ? dd('Aset / lokasi', esc(t.asset)) : ''}
        ${dd('PIC', esc(t.pic || '-'))}${dd('Prioritas', PRIO[t.prio] || PRIO.normal)}${t.est ? dd('Perkiraan biaya', rp(t.est)) : ''}${dd('Pengulangan', RECUR[t.recur] || RECUR.once)}
        ${dd(t.done ? 'Selesai' : 'Tenggat', fd(t.done && last ? last.doneAt : t.due))}${t.done ? '' : dd('Ingatkan', (t.remind || 7) + ' hari sebelumnya')}${t.done ? '' : dd('Status', t.doing ? 'Sedang dikerjakan' : 'Belum dimulai')}
        ${last ? dd('Terakhir selesai', fd(last.doneAt) + (last.cost ? ' · ' + rp(last.cost) : '')) : ''}${t.note ? dd('Catatan', esc(t.note)) : ''}</dl>
        <div class="bl-det-actions">${t.done ? '' : bt(`TK.finish('${t.id}')`, 'fa-circle-check', 'Selesaikan', 'amber')}${t.done ? '' : bt(`TK.start('${t.id}')`, 'fa-gears', t.doing ? 'Batal dikerjakan' : 'Mulai dikerjakan')}${t.done ? '' : bt(`TK.remind('${t.id}')`, 'fa-paper-plane', 'Kirim Pengingat')}${bt(`TK.hist('${t.id}')`, 'fa-clock-rotate-left', 'Riwayat')}${bt(`TK.edit('${t.id}')`, 'fa-pen', 'Edit')}${bt(`TK.del('${t.id}')`, 'fa-trash', 'Hapus', 'ghost bl-btn-danger')}</div>` });
  };
  // Buka WhatsApp dengan teks pengingat siap kirim; bila nomor PIC diisi, langsung ke PIC tersebut
  TK.remind = function (id) {
    const t = TK.items[id]; if (!t || t.done) return; const d = days(t.due);
    const w = d < 0 ? `sudah terlambat ${-d} hari (tenggat ${fd(t.due)})` : d === 0 ? 'tenggatnya hari ini' : `tenggat ${fd(t.due)} (${d} hari lagi)`;
    const msg = `Halo${t.pic ? ' ' + t.pic : ''}, pengingat pekerjaan *${t.name}*${t.branch ? ' (cabang ' + t.branch + ')' : ''}${t.asset ? ' untuk ' + t.asset : ''}: ${w}. Mohon segera dikerjakan dan dikabari hasilnya. Terima kasih. - Divisi GA`;
    let num = String(t.wa || '').replace(/\D/g, ''); if (num.startsWith('0')) num = '62' + num.slice(1);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  /* ---------- tambah / ubah ---------- */
  async function form(t) {
    const cur = t || {}, brs = GAX.branchesAll();
    if (cur.branch && !brs.includes(cur.branch)) brs.unshift(cur.branch);
    const o = await ask(t ? 'Edit Pekerjaan' : 'Tambah Pekerjaan', [
      { k: 'name', l: 'Nama pekerjaan (mis. Servis AC lantai 2)', v: cur.name || '', req: true },
      { k: 'cat', l: 'Kategori', v: cur.cat || CATS[0], opts: CATS.map(x => [x, x]) },
      { k: 'branch', l: 'Cabang', v: cur.branch || '', opts: [['', 'Umum / Kantor Pusat']].concat(brs.map(x => [x, x])) },
      { k: 'asset', l: 'Aset / lokasi terkait (opsional)', v: cur.asset || '' },
      { k: 'pic', l: 'Penanggung jawab / vendor (opsional)', v: cur.pic || '' },
      { k: 'wa', l: 'No. WhatsApp PIC (opsional, untuk Kirim Pengingat)', v: cur.wa || '', t: 'tel' },
      { k: 'prio', l: 'Prioritas', v: cur.prio || 'normal', opts: Object.keys(PRIO).map(k => [k, PRIO[k]]) },
      { k: 'est', l: 'Perkiraan biaya (Rp, opsional)', v: cur.est || '', t: 'number' },
      { k: 'recur', l: 'Pengulangan', v: cur.recur || 'once', opts: Object.keys(RECUR).map(k => [k, RECUR[k]]) },
      { k: 'due', l: t ? 'Tenggat berikutnya' : 'Tenggat pertama', v: cur.due || today(), t: 'date', req: true },
      { k: 'remind', l: 'Ingatkan', v: String(cur.remind || 7), opts: [['1', '1 hari sebelumnya'], ['3', '3 hari sebelumnya'], ['7', '7 hari sebelumnya'], ['14', '14 hari sebelumnya']] },
      { k: 'note', l: 'Catatan (opsional)', v: cur.note || '' }
    ], 'Simpan', { check: v => !/^\d{4}-\d{2}-\d{2}$/.test(v.due) ? 'Tanggal tenggat tidak valid' : (v.est && Number(v.est) < 0 ? 'Biaya tidak boleh negatif' : '') });
    if (!o) return;
    const nt = Object.assign({ log: [], done: false, doing: false, deleted: false }, cur, {
      id: cur.id || 'TSK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      name: o.name, cat: o.cat, branch: o.branch, asset: o.asset, pic: o.pic, wa: o.wa, prio: o.prio, est: Number(o.est) || 0,
      recur: o.recur, due: o.due, day: +o.due.slice(8, 10), remind: +o.remind, note: o.note
    });
    if (t && t.done && nt.recur !== 'once') nt.done = false; // sekali-jalan yang diubah jadi berulang aktif lagi
    put(nt); renderActive(); try { TK.notify(); } catch (e) { console.error(e); }
  }
  TK.add = () => form(null);
  TK.edit = id => { if (TK.items[id]) form(TK.items[id]); };

  /* ---------- mulai / selesai / riwayat / hapus ---------- */
  TK.start = function (id) {
    const t = TK.items[id]; if (!t || t.done) return;
    put(Object.assign({}, t, { doing: !t.doing })); renderActive();
  };
  TK.finish = async function (id) {
    const t = TK.items[id]; if (!t || t.done) return;
    const o = await ask('Tandai Pekerjaan Selesai', [
      { k: 'date', l: 'Tanggal selesai', v: today(), t: 'date', req: true },
      { k: 'cost', l: 'Biaya aktual (Rp, opsional)', v: t.est || '', t: 'number' },
      { k: 'note', l: 'Catatan hasil pekerjaan (opsional)', v: '' }
    ], 'Tandai Selesai', { html: `<p class="text-left text-[11px] text-dobah-200/60 mt-3">${esc(t.name)} · tenggat ${fd(t.due)}${t.recur !== 'once' ? '<br>Tenggat berikutnya otomatis maju ke ' + fd(addPeriod(t.due, t.recur, t.day)) + '.' : ''}</p>` });
    if (!o) return;
    const nt = JSON.parse(JSON.stringify(t));
    nt.log = (nt.log || []).concat([{ due: t.due, doneAt: o.date, cost: Number(o.cost) || 0, note: o.note, by: who() }]);
    nt.doing = false;
    if (nt.recur === 'once') nt.done = true; else nt.due = addPeriod(t.due, t.recur, t.day);
    put(nt); renderActive();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pekerjaan ditandai selesai', showConfirmButton: false, timer: 2500, ...SW });
  };
  TK.hist = async function (id) {
    const t = TK.items[id]; if (!t) return;
    const P = (t.log || []).slice().reverse();
    const rows = P.map(p => `<tr><td class="p-2">${fd(p.due)}</td><td class="p-2">${fd(p.doneAt)}</td><td class="p-2 font-mono">${p.cost ? rp(p.cost) : '-'}</td><td class="p-2">${esc(p.by || '-')}${p.note ? '<br><span class="text-dobah-200/60">' + esc(p.note) + '</span>' : ''}</td></tr>`).join('');
    const r = await Swal.fire({ title: 'Riwayat ' + esc(t.name), width: 560, ...SW, showDenyButton: !!P.length, denyButtonText: 'Batalkan penyelesaian terakhir', confirmButtonText: 'Tutup',
      html: P.length ? `<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-dobah-200/70 uppercase"><th class="p-2">Tenggat</th><th class="p-2">Selesai</th><th class="p-2">Biaya</th><th class="p-2">Oleh</th></tr></thead><tbody class="divide-y divide-white/5">${rows}</tbody></table></div>` : '<p class="text-xs text-dobah-200/60 italic">Belum ada penyelesaian tercatat.</p>' });
    if (!r.isDenied) return;
    if (!(await confirmBox('Batalkan penyelesaian terakhir?', 'Tenggat dikembalikan ke ' + fd(P[0].due) + ' dan pekerjaan kembali berstatus belum selesai.'))) return;
    const nt = JSON.parse(JSON.stringify(t)), last = nt.log.pop();
    nt.due = last.due; nt.done = false; put(nt); renderActive();
  };
  TK.del = async function (id) {
    const t = TK.items[id]; if (!t) return;
    if (!(await confirmBox('Hapus pekerjaan?', `"${t.name}" beserta riwayatnya tidak akan tampil lagi.`))) return;
    put(Object.assign({}, t, { deleted: true })); renderActive();
  };
  TK.csv = function () {
    const rows = [['Nama', 'Kategori', 'Cabang', 'Aset / Lokasi', 'PIC', 'Prioritas', 'Perkiraan Biaya', 'Pengulangan', 'Tenggat', 'Status', 'Terakhir Selesai']];
    live().sort((a, b) => rank(a) - rank(b) || String(a.due).localeCompare(String(b.due))).forEach(t => {
      const l = (t.log || []).slice(-1)[0];
      rows.push([t.name, t.cat, t.branch || 'Umum', t.asset, t.pic, PRIO[t.prio] || '', t.est || 0, RECUR[t.recur] || '', t.done ? '' : t.due, label(t) + (t.doing && !t.done ? ' (dikerjakan)' : ''), l ? l.doneAt : '']);
    });
    GAX.csv('pekerjaan-' + GAX.stamp() + '.csv', rows);
  };

  /* ---------- notifikasi dalam aplikasi (GA) ---------- */
  TK.notify = function () {
    if (!isGA()) return; load(); const st = nload(); if (!st) return; NC.fresh = [];
    const act = live().filter(t => !t.done && t.due), nm = L => L.slice(0, 3).map(t => t.name).join(', ') + (L.length > 3 ? ` +${L.length - 3}` : '');
    const late = act.filter(t => days(t.due) < 0);
    if (late.length) add({ key: 'tk|late|' + ld(), type: 'task', level: 'danger', tab: 'atsk', title: `${late.length} pekerjaan melewati tenggat`, msg: nm(late) });
    act.forEach(t => {
      const d = days(t.due); if (d < 0 || d > (t.remind || 7)) return;
      const bk = d === 0 ? 0 : [1, 3, 7, 14].find(x => x >= d), br = t.branch ? ' · ' + t.branch : '';
      add({ key: `tk|${t.id}|${t.due}|${bk}`, type: 'task', level: d <= 1 || t.prio === 'high' && d <= 3 ? 'danger' : d <= 3 ? 'warn' : 'info', tab: 'atsk',
        title: d === 0 ? 'Pekerjaan jatuh tempo hari ini' : `Pekerjaan jatuh tempo ${d} hari lagi`, msg: `${t.name}${br} (${fd(t.due)})` });
    });
    if (NC.fresh.length) { nsave(); ui(); announce(NC.fresh); }
  };
  try { IC.task = 'fa-list-check'; } catch (e) { /* IC tidak tersedia: ikon lonceng dipakai */ }
  const _scan = NC.scan; NC.scan = function () { _scan.apply(this, arguments); try { TK.notify(); } catch (e) { console.error(e); } };

  GAX.regTab('atsk', { title: 'Pengingat Pekerjaan', render: () => TK.render(), gaOnly: true });
  window.addEventListener('profile-ready', () => { load(); watch(); TK.notify(); });
})();
