/* Modul Aset: Pengingat Tagihan (listrik, air, internet, sewa, pajak, asuransi, dll).
   Dimuat setelah 18-vendor-kontak.js. Dibungkus IIFE supaya tidak bentrok dengan nama global modul lain.

   Penyimpanan:
   - settings/bills_v1 -> { items: { [id]: tagihan } }   (satu map; ditulis setDoc merge per tagihan)
   - localStorage 'ga_bills_v1' sebagai cadangan lokal / saat offline

   Satu tagihan = satu "tagihan berulang" atau satu tagihan sekali bayar:
   { id, name, cat, branch, vendor, amount, recur: once|monthly|quarterly|yearly,
     due: 'YYYY-MM-DD'  <- jatuh tempo berikutnya yang BELUM dibayar,
     day: tanggal jangkar (agar 31 -> 28/30 lalu kembali ke 31), remind: 1|3|7|14 hari sebelumnya,
     paid: [{ due, paidAt, amount, ref, by }], done: true bila sekali-bayar sudah lunas, deleted, upd }
   Saat dibayar, tagihan berulang otomatis maju ke periode berikutnya. */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const BL = window.BL = { items: {}, loaded: false, f: { t: 'all', q: '' } };
  const LSK = 'ga_bills_v1', DOC = 'bills_v1';
  const CATS = ['Listrik', 'Air (PDAM)', 'Internet', 'Telepon', 'Sewa', 'Pajak / PBB', 'Asuransi', 'Langganan', 'Lainnya'];
  const RECUR = { once: 'Sekali bayar', monthly: 'Bulanan', quarterly: '3 bulanan', yearly: 'Tahunan' };
  const STEP = { monthly: 1, quarterly: 3, yearly: 12 };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const pad = n => String(n).padStart(2, '0');
  const fd = d => d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '-';
  const lget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage penuh', e); } };
  const who = () => (user() || {}).name || 'System';
  const live = () => Object.values(BL.items).filter(b => !b.deleted);

  /* ---------- tanggal ---------- */
  // Tambah periode ke tanggal jatuh tempo; tanggal jangkar dijaga (31 Jan -> 28 Feb -> 31 Mar)
  function addPeriod(due, recur, day) {
    const step = STEP[recur]; if (!step) return due;
    let y = +due.slice(0, 4), idx = +due.slice(5, 7) - 1 + step;
    y += Math.floor(idx / 12); idx %= 12;
    const dim = new Date(Date.UTC(y, idx + 1, 0)).getUTCDate();
    return `${y}-${pad(idx + 1)}-${pad(Math.min(day || +due.slice(8, 10), dim))}`;
  }
  BL.addPeriod = addPeriod;

  /* ---------- cloud (tidak pernah ditunggu oleh UI) ---------- */
  function cloudSet(data) {
    if (!window.db) return Promise.resolve(false);
    const { setDoc, doc } = window.fbDeps;
    return setDoc(doc(window.db, 'settings', DOC), data, { merge: true }).then(() => true).catch(e => { console.warn('Tagihan cloud:', e.code || e); return false; });
  }
  function put(b) { b.upd = Date.now(); BL.items[b.id] = b; lset(LSK, BL.items); cloudSet({ items: { [b.id]: b } }); }
  function merge(remote) {
    let ch = false;
    Object.keys(remote || {}).forEach(k => { const c = BL.items[k], r = remote[k]; if (!c || (r.upd || 0) >= (c.upd || 0)) { if (!c || (r.upd || 0) !== (c.upd || 0)) ch = true; BL.items[k] = r; } });
    if (ch) lset(LSK, BL.items);
    return ch;
  }
  function load() { if (!BL.loaded) { BL.items = lget(LSK) || {}; BL.loaded = true; } }
  function watch() {
    if (BL.sub || !window.db) return; BL.sub = true;
    try {
      const { onSnapshot, doc } = window.fbDeps;
      onSnapshot(doc(window.db, 'settings', DOC), snap => {
        if (!snap.exists() || (snap.metadata && snap.metadata.hasPendingWrites)) return;
        load(); if (merge((snap.data() || {}).items)) { renderActive(); try { BL.notify(); } catch (e) { console.error(e); } }
      }, () => {});
    } catch (e) { console.warn(e); }
  }
  const renderActive = () => { if (appState.activeTab === 'abil') BL.render(); };

  /* ---------- status ---------- */
  function stat(b) { if (b.done) return 'paid'; const d = days(b.due); return d < 0 ? 'late' : d <= (b.remind || 7) ? 'soon' : 'ok'; }
  const SC = { late: 'rose', soon: 'amber', ok: 'emerald', paid: 'slate' };
  function label(b) {
    const s = stat(b), d = days(b.due);
    return s === 'paid' ? 'Lunas' : s === 'late' ? `Terlambat ${-d} hari` : d === 0 ? 'Jatuh tempo hari ini' : `${d} hari lagi`;
  }

  /* ---------- tampilan ---------- */
  const CI = { 'Listrik': 'fa-fire', 'Air (PDAM)': 'fa-circle-dot', 'Internet': 'fa-cloud-arrow-up', 'Telepon': 'fa-phone', 'Sewa': 'fa-store',
    'Pajak / PBB': 'fa-scale-balanced', 'Asuransi': 'fa-file-contract', 'Langganan': 'fa-arrows-rotate', 'Lainnya': 'fa-money-bill-wave' };
  const SCLS = { late: 'late', soon: 'soon', ok: 'ok', paid: 'paid' };
  const RIB = { late: 'Terlambat', soon: 'Segera Jatuh Tempo', paid: 'Lunas' };
  // keterangan selisih hari di bawah tanggal jatuh tempo
  function when(b) { const d = days(b.due); return d < 0 ? `${-d} hari terlambat` : d === 0 ? 'Hari ini' : `${d} hari lagi`; }
  function card(b) {
    const s = stat(b), paid = b.paid || [], last = paid[paid.length - 1], act = [];
    if (s === 'late' || s === 'soon') act.push(`<button type="button" class="bl-btn ${s === 'late' ? 'bl-btn-dark' : 'bl-btn-amber'}" onclick="BL.pay('${b.id}')">Bayar Sekarang</button>`);
    if (s === 'late') act.push(`<button type="button" class="bl-btn bl-btn-ghost" onclick="BL.detail('${b.id}')">Detail</button>`);
    else if (s === 'soon') act.push(`<button type="button" class="bl-btn bl-btn-ghost" onclick="BL.remind('${b.id}')">Kirim Pengingat</button>`);
    else if (s === 'ok') act.push(`<button type="button" class="bl-btn bl-btn-ghost" onclick="BL.detail('${b.id}')">Detail</button><button type="button" class="bl-btn bl-btn-ghost" onclick="BL.remind('${b.id}')">Kirim Pengingat</button>`);
    else act.push(`<button type="button" class="bl-btn bl-btn-ghost" onclick="BL.detail('${b.id}')">Detail</button>`);
    const dateCol = b.done
      ? `<div class="bl-d"><span>Dibayar</span><b>${fd(last ? last.paidAt : b.due)}</b></div>`
      : `<div class="bl-d"><span>Jatuh Tempo</span><b>${fd(b.due)}</b><small>${when(b)}</small></div>`;
    return `<article class="bl-card ${SCLS[s]}">${RIB[s] ? `<span class="bl-rib">${RIB[s]}</span>` : ''}
      <div class="bl-head"><span class="bl-ico" aria-hidden="true"><i class="fa-solid ${CI[b.cat] || CI.Lainnya}"></i></span><h3 class="bl-name" title="${esc(b.name)}">${esc(b.name)}</h3></div>
      <div class="bl-body"><div class="bl-who"><div>Vendor: <b>${esc(b.vendor || '-')}</b></div><div>Cabang: <b>${esc(b.branch || 'Umum')}</b></div></div>
        <div class="bl-dates"><div class="bl-d"><span>Berulang</span><b>${RECUR[b.recur] || RECUR.once}</b></div>${dateCol}</div></div>
      <div class="bl-foot"><div class="bl-amt">${b.amount ? rp(b.amount) : '<small>Nominal belum diisi</small>'}</div><div class="bl-acts">${act.join('')}</div></div></article>`;
  }
  const rank = b => b.done ? 9 : ({ late: 0, soon: 1, ok: 2 })[stat(b)];
  const FL = { all: 'Semua tagihan', act: 'Belum lunas', late: 'Terlambat', soon: 'Segera jatuh tempo', ok: 'Aman', paid: 'Lunas', d30: 'Jatuh tempo ≤ 30 hari' };
  const match = (b, t) => t === 'all' || (t === 'act' ? !b.done : t === 'd30' ? !b.done && days(b.due) <= 30 : stat(b) === t);
  function grid() {
    const el = $('blGrid'); if (!el) return;
    const f = BL.f, qq = (f.q || '').toLowerCase();
    const L = live().filter(b => match(b, f.t) && (!qq || [b.name, b.cat, b.branch, b.vendor].join(' ').toLowerCase().includes(qq)))
      .sort((a, b) => rank(a) - rank(b) || String(a.due).localeCompare(String(b.due)));
    el.innerHTML = L.length ? L.map(card).join('') : '<div class="bl-empty"><div class="empty-donut"></div>Belum ada tagihan pada filter ini.</div>';
  }
  // kartu ringkasan yang bisa diklik (diberi cincin oranye saat filternya aktif)
  const kcard = (l, v, ic, tone, k) => `<button type="button" class="bl-kpi t-${tone}${BL.f.t === k ? ' is-on' : ''}" onclick="BL.pick('${k}')" aria-pressed="${BL.f.t === k}" title="Klik untuk menampilkan">
    <span class="bl-kpi-top"><span class="bl-kpi-lbl">${l}</span><span class="bl-kpi-ico"><i class="fa-solid ${ic}"></i></span></span><span class="bl-kpi-num">${v}</span></button>`;
  BL.render = function () {
    const v = $('view-abil'); if (!v) return; load();
    const A = live(), act = A.filter(b => !b.done), late = act.filter(b => stat(b) === 'late'), soon = act.filter(b => stat(b) === 'soon'),
      d30 = act.filter(b => days(b.due) <= 30), sum30 = d30.reduce((n, b) => n + (Number(b.amount) || 0), 0), f = BL.f,
      cnt = { all: A.length, act: act.length, late: late.length, soon: soon.length, ok: act.length - late.length - soon.length, paid: A.length - act.length, d30: d30.length };
    const sel = Object.keys(FL).map(k => `<option value="${k}" ${f.t === k ? 'selected' : ''}>${FL[k]} (${cnt[k]})</option>`).join('');
    v.innerHTML = `<div class="bl-kpis">${kcard('Tagihan Aktif', act.length, 'fa-money-bill-wave', 'act', 'act')}${kcard('Terlambat', late.length, 'fa-triangle-exclamation', 'late', 'late')}${kcard('Segera Jatuh Tempo', soon.length, 'fa-hourglass-half', 'soon', 'soon')}${kcard('Nominal ≤ 30 Hari', rp(sum30), 'fa-wallet', 'sum', 'd30')}</div>
      <div id="blBar" class="bl-bar"><select onchange="BL.tab(this.value)" class="bl-select" aria-label="Filter tagihan">${sel}</select>
        <input type="search" placeholder="Cari nama tagihan / cabang / vendor..." value="${esc(f.q)}" oninput="BL.q(this.value)" class="bl-search" aria-label="Cari tagihan">
        <button type="button" onclick="BL.csv()" class="bl-btn bl-btn-ghost"><i class="fa-solid fa-file-csv"></i>.CSV</button><button type="button" onclick="BL.add()" class="bl-btn bl-btn-amber"><i class="fa-solid fa-plus"></i>Tambah Tagihan</button></div>
      <div id="blGrid" class="bl-grid"></div>`;
    grid();
  };
  BL.pick = k => { BL.f.t = BL.f.t === k ? 'all' : k; BL.render(); const c = $('blBar'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  BL.tab = k => { BL.f.t = FL[k] ? k : 'all'; BL.render(); };
  BL.q = v => { BL.f.q = v; grid(); };

  /* ---------- detail & kirim pengingat ---------- */
  BL.detail = function (id) {
    const b = BL.items[id]; if (!b) return;
    const s = stat(b), last = (b.paid || []).slice(-1)[0], dd = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const bt = (fn, ic, t, cls) => `<button type="button" class="bl-btn bl-btn-${cls || 'ghost'}" onclick="Swal.close();${fn}"><i class="fa-solid ${ic}"></i>${t}</button>`;
    Swal.fire({ title: esc(b.name), width: 520, showConfirmButton: false, showCloseButton: true, ...SW,
      html: `<span class="bl-det-st ${s}">${label(b)}</span><dl class="bl-dl">${dd('Kategori', esc(b.cat || 'Lainnya'))}${dd('Vendor', esc(b.vendor || '-'))}${dd('Cabang', esc(b.branch || 'Umum / Kantor Pusat'))}
        ${dd('Nominal', b.amount ? rp(b.amount) : 'Belum diisi')}${dd('Pengulangan', RECUR[b.recur] || RECUR.once)}${dd(b.done ? 'Dibayar' : 'Jatuh tempo', fd(b.done && last ? last.paidAt : b.due))}
        ${b.done ? '' : dd('Ingatkan', (b.remind || 7) + ' hari sebelumnya')}${last ? dd('Terakhir dibayar', fd(last.paidAt) + (last.amount ? ' · ' + rp(last.amount) : '')) : ''}${b.note ? dd('Catatan', esc(b.note)) : ''}</dl>
        <div class="bl-det-actions">${b.done ? '' : bt(`BL.pay('${b.id}')`, 'fa-circle-check', 'Bayar', 'amber')}${b.done ? '' : bt(`BL.remind('${b.id}')`, 'fa-paper-plane', 'Kirim Pengingat')}${bt(`BL.hist('${b.id}')`, 'fa-clock-rotate-left', 'Riwayat')}${bt(`BL.edit('${b.id}')`, 'fa-pen', 'Edit')}${bt(`BL.del('${b.id}')`, 'fa-trash', 'Hapus', 'ghost bl-btn-danger')}</div>` });
  };
  // Buka WhatsApp dengan teks pengingat siap kirim (penerima dipilih sendiri)
  BL.remind = function (id) {
    const b = BL.items[id]; if (!b || b.done) return; const d = days(b.due);
    const w = d < 0 ? `sudah terlambat ${-d} hari (jatuh tempo ${fd(b.due)})` : d === 0 ? 'jatuh tempo hari ini' : `jatuh tempo ${fd(b.due)} (${d} hari lagi)`;
    const msg = `Halo, pengingat tagihan *${b.name}*${b.vendor ? ' ke ' + b.vendor : ''}${b.branch ? ' (cabang ' + b.branch + ')' : ''}: ${b.amount ? rp(b.amount) + ', ' : ''}${w}. Mohon segera diproses. Terima kasih. - Divisi GA`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  /* ---------- tambah / ubah ---------- */
  async function form(b) {
    const cur = b || {}, brs = GAX.branchesAll();
    if (cur.branch && !brs.includes(cur.branch)) brs.unshift(cur.branch);
    const o = await ask(b ? 'Edit Tagihan' : 'Tambah Tagihan', [
      { k: 'name', l: 'Nama tagihan', v: cur.name || '', req: true },
      { k: 'cat', l: 'Kategori', v: cur.cat || 'Listrik', opts: CATS.map(x => [x, x]) },
      { k: 'branch', l: 'Cabang', v: cur.branch || '', opts: [['', 'Umum / Kantor Pusat']].concat(brs.map(x => [x, x])) },
      { k: 'vendor', l: 'Penerima / penyedia (opsional)', v: cur.vendor || '' },
      { k: 'amount', l: 'Nominal perkiraan (Rp)', v: cur.amount || '', t: 'number' },
      { k: 'recur', l: 'Pengulangan', v: cur.recur || 'monthly', opts: Object.keys(RECUR).map(k => [k, RECUR[k]]) },
      { k: 'due', l: b ? 'Jatuh tempo berikutnya' : 'Jatuh tempo pertama', v: cur.due || today(), t: 'date', req: true },
      { k: 'remind', l: 'Ingatkan', v: String(cur.remind || 7), opts: [['1', '1 hari sebelumnya'], ['3', '3 hari sebelumnya'], ['7', '7 hari sebelumnya'], ['14', '14 hari sebelumnya']] },
      { k: 'note', l: 'Catatan (opsional)', v: cur.note || '' }
    ], 'Simpan', { check: v => !/^\d{4}-\d{2}-\d{2}$/.test(v.due) ? 'Tanggal jatuh tempo tidak valid' : (v.amount && Number(v.amount) < 0 ? 'Nominal tidak boleh negatif' : '') });
    if (!o) return;
    const nb = Object.assign({ paid: [], done: false, deleted: false }, cur, {
      id: cur.id || 'BIL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      name: o.name, cat: o.cat, branch: o.branch, vendor: o.vendor, amount: Number(o.amount) || 0, recur: o.recur, due: o.due,
      day: +o.due.slice(8, 10), remind: +o.remind, note: o.note
    });
    if (b && b.done && nb.recur !== 'once') nb.done = false; // sekali-bayar yang diubah jadi berulang aktif lagi
    put(nb); renderActive(); try { BL.notify(); } catch (e) { console.error(e); }
  }
  BL.add = () => form(null);
  BL.edit = id => { if (BL.items[id]) form(BL.items[id]); };

  /* ---------- bayar / riwayat / hapus ---------- */
  BL.pay = async function (id) {
    const b = BL.items[id]; if (!b || b.done) return;
    const o = await ask('Catat Pembayaran', [
      { k: 'amount', l: 'Nominal dibayar (Rp)', v: b.amount || '', t: 'number' },
      { k: 'date', l: 'Tanggal bayar', v: today(), t: 'date', req: true },
      { k: 'ref', l: 'No. referensi / catatan (opsional)', v: '' }
    ], 'Tandai Lunas', { html: `<p class="text-left text-[11px] text-dobah-200/60 mt-3">${esc(b.name)} · jatuh tempo ${fd(b.due)}${b.recur !== 'once' ? '<br>Jatuh tempo berikutnya otomatis maju ke ' + fd(addPeriod(b.due, b.recur, b.day)) + '.' : ''}</p>` });
    if (!o) return;
    const nb = JSON.parse(JSON.stringify(b));
    nb.paid = (nb.paid || []).concat([{ due: b.due, paidAt: o.date, amount: Number(o.amount) || 0, ref: o.ref, by: who() }]);
    if (nb.recur === 'once') nb.done = true; else nb.due = addPeriod(b.due, b.recur, b.day);
    put(nb); renderActive();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pembayaran dicatat', showConfirmButton: false, timer: 2500, ...SW });
  };
  BL.hist = async function (id) {
    const b = BL.items[id]; if (!b) return;
    const P = (b.paid || []).slice().reverse();
    const rows = P.map(p => `<tr><td class="p-2">${fd(p.due)}</td><td class="p-2">${fd(p.paidAt)}</td><td class="p-2 font-mono">${p.amount ? rp(p.amount) : '-'}</td><td class="p-2">${esc(p.by || '-')}${p.ref ? '<br><span class="text-dobah-200/60">' + esc(p.ref) + '</span>' : ''}</td></tr>`).join('');
    const r = await Swal.fire({ title: 'Riwayat ' + esc(b.name), width: 560, ...SW, showDenyButton: !!P.length, denyButtonText: 'Batalkan pembayaran terakhir', confirmButtonText: 'Tutup',
      html: P.length ? `<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-dobah-200/70 uppercase"><th class="p-2">Jatuh tempo</th><th class="p-2">Dibayar</th><th class="p-2">Nominal</th><th class="p-2">Oleh</th></tr></thead><tbody class="divide-y divide-white/5">${rows}</tbody></table></div>` : '<p class="text-xs text-dobah-200/60 italic">Belum ada pembayaran tercatat.</p>' });
    if (!r.isDenied) return;
    if (!(await confirmBox('Batalkan pembayaran terakhir?', 'Jatuh tempo dikembalikan ke ' + fd(P[0].due) + ' dan tagihan kembali berstatus belum dibayar.'))) return;
    const nb = JSON.parse(JSON.stringify(b)), last = nb.paid.pop();
    nb.due = last.due; nb.done = false; put(nb); renderActive();
  };
  BL.del = async function (id) {
    const b = BL.items[id]; if (!b) return;
    if (!(await confirmBox('Hapus tagihan?', `"${b.name}" beserta riwayat pembayarannya tidak akan tampil lagi.`))) return;
    put(Object.assign({}, b, { deleted: true })); renderActive();
  };
  BL.csv = function () {
    const rows = [['Nama', 'Kategori', 'Cabang', 'Penyedia', 'Nominal', 'Pengulangan', 'Jatuh Tempo', 'Status', 'Terakhir Dibayar']];
    live().sort((a, b) => rank(a) - rank(b) || String(a.due).localeCompare(String(b.due))).forEach(b => {
      const l = (b.paid || []).slice(-1)[0];
      rows.push([b.name, b.cat, b.branch || 'Umum', b.vendor, b.amount || 0, RECUR[b.recur] || '', b.done ? '' : b.due, label(b), l ? l.paidAt : '']);
    });
    GAX.csv('tagihan-' + GAX.stamp() + '.csv', rows);
  };

  /* ---------- notifikasi dalam aplikasi (GA) ---------- */
  BL.notify = function () {
    if (!isGA()) return; load(); const st = nload(); if (!st) return; NC.fresh = [];
    const act = live().filter(b => !b.done && b.due), nm = L => L.slice(0, 3).map(b => b.name).join(', ') + (L.length > 3 ? ` +${L.length - 3}` : '');
    const late = act.filter(b => days(b.due) < 0);
    if (late.length) add({ key: 'bl|late|' + ld(), type: 'bill', level: 'danger', tab: 'abil', title: `${late.length} tagihan terlambat dibayar`, msg: nm(late) });
    act.forEach(b => {
      const d = days(b.due); if (d < 0 || d > (b.remind || 7)) return;
      const bk = d === 0 ? 0 : [1, 3, 7, 14].find(x => x >= d), amt = b.amount ? ' · ' + rp(b.amount) : '', br = b.branch ? ' · ' + b.branch : '';
      add({ key: `bl|${b.id}|${b.due}|${bk}`, type: 'bill', level: d <= 1 ? 'danger' : d <= 3 ? 'warn' : 'info', tab: 'abil',
        title: d === 0 ? 'Tagihan jatuh tempo hari ini' : `Tagihan jatuh tempo ${d} hari lagi`, msg: `${b.name}${br}${amt} (${fd(b.due)})` });
    });
    if (NC.fresh.length) { nsave(); ui(); announce(NC.fresh); }
  };
  try { IC.bill = 'fa-money-bill-wave'; } catch (e) { /* IC tidak tersedia: ikon lonceng dipakai */ }
  const _scan = NC.scan; NC.scan = function () { _scan.apply(this, arguments); try { BL.notify(); } catch (e) { console.error(e); } };

  GAX.regTab('abil', { title: 'Pengingat Tagihan', render: () => BL.render(), gaOnly: true });
  window.addEventListener('profile-ready', () => { load(); watch(); BL.notify(); });
})();
