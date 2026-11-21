/* Dashboard Aset — 3 gaya layout (krem hangat + amber lembut): Bento Grid, Split Master-Detail, Command Center.
   Menggantikan dash() dari 02-registry.js. Pilihan layout disimpan di localStorage 'ga_dash'. */
(() => {
  const KEY = 'ga_dash', LAYS = { bento: ['fa-table-cells-large', 'Bento'], split: ['fa-table-columns', 'Cabang'], cmd: ['fa-bolt', 'Aksi'] };
  const lay = () => { try { const v = localStorage.getItem(KEY); if (LAYS[v]) return v; } catch (e) {} return 'bento'; };
  const css = n => (window.themeVar ? themeVar(n, '') : '') || '';
  const kRp = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.0', '') + ' M' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' jt' : rp(n);
  const kRpFull = n => 'Rp ' + kRp(n).replace(/^Rp\s?/, '');

  function data() {
    const L = mine(), act = L.filter(a => !dead(a)), c = s => sq(L.filter(a => a.status === s));
    const val = act.reduce((s, a) => s + tot(a), 0), book = act.reduce((s, a) => s + dep(a).book, 0);
    const od = isGA() ? overdue().length : 0, imp = isGA() ? pendingImport().length : 0;
    const inN = L.filter(a => inc(a) && !dead(a)).length;
    const exp = AM.vendors.filter(v => days(v.expiry) <= 60);
    const tasks = [];
    if (c('Broken')) tasks.push({ t: 'rose', i: 'fa-triangle-exclamation', h: c('Broken') + ' aset rusak', s: 'Belum ditangani', b: 'Tangani', js: "switchTab('amtc')" });
    if (imp) tasks.push({ t: 'orange', i: 'fa-link', h: imp + ' item belum sinkron', s: 'Dari permintaan berstatus Selesai', b: 'Sinkronkan', js: 'AM.sync()' });
    if (inN) tasks.push({ t: 'amber', i: 'fa-pen-to-square', h: inN + ' data belum lengkap', s: 'Kategori / cabang / harga kosong', b: 'Lengkapi', js: "AM.f.st='INCOMPLETE';AM.f.page=1;switchTab('areg')" });
    if (od) tasks.push({ t: 'rose', i: 'fa-clock', h: od + ' peminjaman terlambat', s: 'Lewat batas pengembalian', b: 'Lihat', js: "switchTab('aasg')" });
    exp.forEach(v => tasks.push({ t: 'amber', i: 'fa-file-contract', h: 'Kontrak ' + esc(v.name), s: days(v.expiry) < 0 ? 'Sudah berakhir' : 'Berakhir ' + days(v.expiry) + ' hari lagi', b: 'Buka', js: "switchTab('" + (isGA() ? 'aven' : 'adash') + "')" }));
    const mt = L.filter(a => a.status === 'Maintenance' || a.status === 'Broken');
    const bm = {};
    L.forEach(a => { const b = a.branch || '(Tanpa cabang)'; const o = bm[b] || (bm[b] = { n: b, u: 0, v: 0, good: 0, bad: 0, mt: 0, items: [] }); if (dead(a)) return; o.u += q(a); o.v += tot(a); o.items.push(a); if (a.status === 'Good') o.good += q(a); else o.bad += q(a); if (a.status === 'Maintenance') o.mt += q(a); });
    const br = Object.values(bm).map(o => (o.h = o.u ? o.good / o.u : 1, o.hs = o.h >= .9 ? 'ok' : o.h >= .7 ? 'warn' : 'bad', o)).sort((a, b) => b.v - a.v);
    const cat = {}; act.forEach(a => { const k = a.category || '(Belum dikategorikan)'; cat[k] = (cat[k] || 0) + q(a); });
    const log = []; L.forEach(a => (a.history || []).slice(-1).forEach(h => log.push({ a, h })));
    return { L, act, c, val, book, tasks, mt, br, cat, log: log.reverse(), units: sq(act), od, imp };
  }

  const sw = cur => `<div class="cz-head"><div><h2 class="cz-title">Dashboard Aset</h2><p class="cz-sub">Ringkasan kondisi, nilai, dan pekerjaan yang perlu ditindaklanjuti</p></div>
    <div class="cz-seg" role="tablist">${Object.entries(LAYS).map(([k, [i, l]]) => `<button class="${k === cur ? 'on' : ''}" onclick="CZ.set('${k}')"><i class="fa-solid ${i}"></i><span>${l}</span></button>`).join('')}</div></div>`;
  const task = t => `<div class="cz-task" data-t="${t.t}"><span class="cz-ic"><i class="fa-solid ${t.i}"></i></span><div class="cz-tx"><b>${t.h}</b><small>${t.s}</small></div><button class="cz-btn" onclick="${t.js}">${t.b}</button></div>`;
  const tasks = d => d.tasks.length ? d.tasks.map(task).join('') : '<p class="cz-empty"><i class="fa-solid fa-circle-check"></i> Semua beres, tidak ada tindak lanjut.</p>';
  const stat = (l, v, ic, t = '') => `<div class="cz-card cz-stat" data-t="${t}"><span class="cz-ic"><i class="fa-solid ${ic}"></i></span><small>${l}</small><b>${v}</b></div>`;
  const dot = h => `<i class="cz-dot" data-h="${h}"></i>`;
  const hLbl = { ok: 'Sehat', warn: 'Perlu perhatian', bad: 'Kritis' };
  const logTbl = (rows, n) => `<div class="cz-tblw"><table class="cz-tbl"><thead><tr><th>Aset</th><th>Cabang</th><th>Aktivitas</th><th>Oleh</th><th>Waktu</th></tr></thead><tbody>${rows.slice(0, n).map(({ a, h }) => `<tr><td><b>${esc(a.name)}</b><small>${esc(a.id)}</small></td><td>${esc(a.branch) || '—'}</td><td>${esc(h.act || '')}</td><td>${esc(h.by || '—')}</td><td>${esc(h.t || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="cz-empty">Belum ada aktivitas.</td></tr>'}</tbody></table></div>`;

  function trend(L) {
    const now = new Date(), m = [], v = [], lb = [];
    for (let i = 11; i >= 0; i--) { const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); m.push(e); lb.push(e.toLocaleDateString('id-ID', { month: 'short' })); }
    m.forEach(e => v.push(L.filter(a => !dead(a) && a.date && new Date(a.date) <= e).reduce((s, a) => s + tot(a), 0)));
    return { lb, v };
  }
  const ink = () => css('--chart-text') || '#6b4423', grid = () => css('--chart-grid') || 'rgba(110,60,15,.10)';
  function drop() { ['chart', 'chart2'].forEach(k => { if (AM[k]) { try { AM[k].destroy(); } catch (e) {} AM[k] = null; } }); }
  function line(id, t) {
    const el = $(id); if (!el || !window.Chart) return; const ctx = el.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, 'rgba(232,137,43,.38)'); g.addColorStop(1, 'rgba(232,137,43,0)');
    AM.chart = new Chart(el, { type: 'line', data: { labels: t.lb, datasets: [{ data: t.v, borderColor: '#e8892b', backgroundColor: g, fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + rp(c.parsed.y) } } }, scales: { x: { grid: { display: false }, ticks: { color: ink() } }, y: { grid: { color: grid() }, ticks: { color: ink(), callback: v => kRp(v) } } } } });
  }
  function hbar(id, obj, slot) {
    const el = $(id); if (!el || !window.Chart) return; const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
    AM[slot] = new Chart(el, { type: 'bar', data: { labels: e.map(x => x[0]), datasets: [{ data: e.map(x => x[1]), backgroundColor: e.map((_, i) => ['#e8892b', '#f2a65a', '#f6c26b', '#f7c9a0', '#d97d26', '#e1b782', '#fcd9b6', '#c9742a'][i % 8]), borderRadius: 8, borderSkipped: false, barThickness: 16 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid() }, ticks: { color: ink(), precision: 0 } }, y: { grid: { display: false }, ticks: { color: ink() } } } } });
  }

  function bento(d) {
    const t = trend(d.L), first = t.v.find(x => x > 0) || 0, g = first ? Math.round((d.val - first) / first * 100) : 0;
    return `<div class="cz-bento">
      <div class="cz-card cz-hero"><div class="cz-row"><div><small>Total nilai aset</small><b class="cz-big">${rp(d.val)}</b><span class="cz-chip">${d.units} unit aktif · nilai buku ${kRpFull(d.book)}</span></div>${first ? `<span class="cz-pill ${g >= 0 ? 'up' : 'dn'}"><i class="fa-solid fa-arrow-trend-${g >= 0 ? 'up' : 'down'}"></i> ${g >= 0 ? '+' : ''}${g}% / 12 bln</span>` : ''}</div><div class="cz-chart"><canvas id="czC1"></canvas></div></div>
      <div class="cz-card cz-tasks"><h3>Tindak lanjut mendesak</h3>${tasks({ tasks: d.tasks.slice(0, 4) })}</div>
      <div class="cz-card"><h3>Peringatan maintenance</h3>${d.mt.length ? d.mt.slice(0, 4).map(a => `<div class="cz-li"><span><b>${esc(a.name)}</b><small>${esc(a.branch)}</small></span>${badge(a.status)}</div>`).join('') : '<p class="cz-empty"><i class="fa-solid fa-circle-check"></i> Tidak ada aset di maintenance.</p>'}<button class="cz-link" onclick="switchTab('amtc')">Semua maintenance →</button></div>
      <div class="cz-card cz-brs"><h3>Status cabang</h3>${d.br.slice(0, 5).map(b => `<div class="cz-li"><span>${dot(b.hs)}<b>${esc(b.n)}</b><small>${b.u} unit · ${Math.round(b.h * 100)}% baik</small></span><em>${kRpFull(b.v)}</em></div>`).join('') || '<p class="cz-empty">Belum ada data.</p>'}</div>
      ${stat('Kondisi baik', d.c('Good'), 'fa-circle-check', 'ok')}${stat('Maintenance', d.c('Maintenance'), 'fa-screwdriver-wrench', 'amber')}${stat('Rusak', d.c('Broken'), 'fa-circle-xmark', 'rose')}${stat('Hilang / dimusnahkan', d.c('Lost') + d.c('Disposed'), 'fa-box-archive')}</div>`;
  }

  function split(d) {
    const sel = d.br.find(b => b.n === AM.dashBr) || d.br[0]; if (!sel) return '<div class="cz-card"><p class="cz-empty">Belum ada aset.</p></div>';
    AM.dashBr = sel.n; const cat = {}; sel.items.forEach(a => { const k = a.category || '(Belum dikategorikan)'; cat[k] = (cat[k] || 0) + q(a); }); AM._czCat = cat;
    const rows = d.log.filter(x => x.a.branch === sel.n || (!x.a.branch && sel.n === '(Tanpa cabang)'));
    return `<div class="cz-split"><div class="cz-card cz-master"><h3>Cabang <small>${d.br.length}</small></h3>${d.br.map((b, i) => `<button class="cz-b ${b.n === sel.n ? 'on' : ''}" onclick="CZ.br(${i})">${dot(b.hs)}<span><b>${esc(b.n)}</b><small>${b.u} unit · ${kRpFull(b.v)}</small></span><em>${Math.round(b.h * 100)}%</em></button>`).join('')}</div>
      <div class="cz-detail"><div class="cz-card"><div class="cz-row"><div><small>Cabang terpilih</small><b class="cz-big sm">${esc(sel.n)}</b></div><span class="cz-pill" data-h="${sel.hs}">${dot(sel.hs)} ${hLbl[sel.hs]}</span></div>
        <div class="cz-mini"><div><small>Unit</small><b>${sel.u}</b></div><div><small>Nilai</small><b>${kRpFull(sel.v)}</b></div><div><small>Kondisi baik</small><b>${sel.good}</b></div><div><small>Butuh perhatian</small><b>${sel.bad}</b></div></div></div>
        <div class="cz-card"><h3>Aset per kategori</h3><div class="cz-chart sm"><canvas id="czC2"></canvas></div></div>
        <div class="cz-card"><h3>Aktivitas aset terbaru</h3>${logTbl(rows, 6)}</div></div></div>`;
  }

  function cmd(d) {
    return `<div class="cz-card cz-act"><h3>Perlu tindakan hari ini <small>${d.tasks.length}</small></h3><div class="cz-grid2">${tasks(d)}</div></div>
      <div class="cz-strip">${stat('Total unit', d.units, 'fa-boxes-stacked')}${stat('Nilai perolehan', kRpFull(d.val), 'fa-wallet')}${stat('Nilai buku', kRpFull(d.book), 'fa-scale-balanced')}${stat('Maintenance', d.c('Maintenance'), 'fa-screwdriver-wrench', 'amber')}${stat('Rusak', d.c('Broken'), 'fa-circle-xmark', 'rose')}</div>
      <div class="cz-card"><h3>Perbandingan kategori aset</h3><div class="cz-chart sm"><canvas id="czC2"></canvas></div></div>
      <div class="cz-card"><h3>Log aset terbaru</h3>${logTbl(d.log, 8)}</div>`;
  }

  function dash() {
    const d = data(), cur = lay(); drop();
    $('view-adash').innerHTML = `<div class="cz-wrap">${sw(cur)}${cur === 'split' ? split(d) : cur === 'cmd' ? cmd(d) : bento(d)}</div>`;
    if (cur === 'bento') line('czC1', trend(d.L)); else hbar('czC2', cur === 'split' ? AM._czCat || {} : d.cat, 'chart2');
  }
  window.dash = dash;
  window.CZ = { set(k) { try { localStorage.setItem(KEY, k); } catch (e) {} dash(); }, br(i) { const b = data().br[i]; if (b) { AM.dashBr = b.n; dash(); } } };
  try { R.adash = dash; } catch (e) {}
})();
