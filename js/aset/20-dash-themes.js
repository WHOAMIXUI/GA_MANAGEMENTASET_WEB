/* Dashboard Aset — 3 layout sesuai mockup (krem hangat + amber): Bento, Split Master-Detail, Command Center.
   Menggantikan dash() dari 02-registry.js. Pilihan disimpan di localStorage 'ga_dash'. */
(() => {
  const KEY = 'ga_dash', LAYS = { bento: ['fa-chart-pie', 'Bento'], split: ['fa-table-columns', 'Cabang'], cmd: ['fa-list-check', 'Aksi'] };
  const lay = () => { try { const v = localStorage.getItem(KEY); if (LAYS[v]) return v; } catch (e) {} return 'bento'; };
  const css = n => (window.themeVar ? themeVar(n, '') : '') || '';
  const kRp = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.0', '') + ' M' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' jt' : String(Math.round(n));
  const R2 = n => 'Rp ' + kRp(n);
  const HL = { ok: 'Sehat', warn: 'Waspada', bad: 'Kritis' };
  const dot = h => `<i class="cz-dot" data-h="${h}"></i>`;
  const pill = h => `<span class="cz-hp" data-h="${h}">${dot(h)}${HL[h]}</span>`;
  const av = n => `<span class="cz-av">${esc((n || '?').trim().charAt(0).toUpperCase())}</span>`;

  function data() {
    const L = mine(), act = L.filter(a => !dead(a)), c = s => sq(L.filter(a => a.status === s)), t0 = today();
    const val = act.reduce((s, a) => s + tot(a), 0), book = act.reduce((s, a) => s + dep(a).book, 0);
    const od = isGA() ? overdue().length : 0, imp = isGA() ? pendingImport().length : 0, inN = L.filter(a => inc(a) && !dead(a)).length;
    const pend = (appState.requests || []).map((r, i) => ({ r, i })).filter(x => x.r.status === 'Menunggu');
    const tasks = [];
    if (c('Broken')) tasks.push({ t: 'rose', i: 'fa-triangle-exclamation', h: c('Broken') + ' aset rusak belum ditangani', b: 'Tangani', js: "switchTab('amtc')" });
    if (inN) tasks.push({ t: 'amber', i: 'fa-pen-to-square', h: inN + ' aset datanya belum lengkap', b: 'Lengkapi', js: "AM.f.st='INCOMPLETE';AM.f.page=1;switchTab('areg')" });
    if (od) tasks.push({ t: 'rose', i: 'fa-clock', h: od + ' peminjaman lewat batas', b: 'Lihat', js: "switchTab('aasg')" });
    AM.vendors.filter(v => days(v.expiry) <= 60).forEach(v => tasks.push({ t: 'amber', i: 'fa-file-contract', h: 'Kontrak ' + esc(v.name) + (days(v.expiry) < 0 ? ' sudah berakhir' : ' berakhir ' + days(v.expiry) + ' hari lagi'), b: 'Selesaikan', js: "switchTab('" + (isGA() ? 'aven' : 'adash') + "')" }));
    const bm = {};
    L.forEach(a => { const b = a.branch || '(Tanpa cabang)'; const o = bm[b] || (bm[b] = { n: b, u: 0, v: 0, good: 0, bad: 0, mt: 0, od: 0, age: [], items: [] });
      if (dead(a)) return; o.u += q(a); o.v += tot(a); o.items.push(a); if (a.date) o.age.push((Date.now() - new Date(a.date)) / 31557600000);
      if (a.status === 'Good') o.good += q(a); else o.bad += q(a); if (a.status === 'Maintenance') { o.mt += q(a); if (a.mtcDate && a.mtcDate < t0) o.od++; } });
    const br = Object.values(bm).map(o => (o.h = o.u ? o.good / o.u : 1, o.hs = o.h >= .9 ? 'ok' : o.h >= .7 ? 'warn' : 'bad', o.avg = o.age.length ? o.age.reduce((s, x) => s + x, 0) / o.age.length : 0, o)).sort((a, b) => b.v - a.v);
    const cat = {}; act.forEach(a => { const k = a.category || '(Belum dikategorikan)'; cat[k] = (cat[k] || 0) + q(a); });
    const log = []; L.forEach(a => (a.history || []).slice(-1).forEach(h => log.push({ a, h }))); log.reverse();
    return { L, act, c, val, book, tasks, br, cat, log, pend, units: sq(act), mt: c('Maintenance'), imp, inN, dp: val ? Math.round((1 - book / val) * 100) : 0 };
  }

  const bars = (o, n = 8) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n), m = Math.max(1, ...e.map(x => x[1]));
    return e.length ? `<div class="cz-hb">${e.map(([k, v], i) => `<div><span title="${esc(k)}">${esc(k)}</span><i><u style="width:${Math.max(4, v / m * 100)}%;--i:${i}"></u></i><b>${v}</b></div>`).join('')}</div>` : '<p class="cz-empty">Belum ada data.</p>'; };
  const sw = cur => `<div class="cz-seg" role="tablist">${Object.entries(LAYS).map(([k, [i, l]]) => `<button class="${k === cur ? 'on' : ''}" onclick="CZ.set('${k}')" title="${l}"><i class="fa-solid ${i}"></i><span>${l}</span></button>`).join('')}</div>`;
  const kcard = (l, v, ic, sub = '') => `<div class="cz-card cz-k"><span class="cz-ic"><i class="fa-solid ${ic}"></i></span><div><small>${l}</small><b>${v}</b>${sub}</div></div>`;
  const tline = ({ a, h }) => `<div class="cz-tl"><i></i><div><b>${esc(h.act || '')}</b><small>${esc(a.name)} · ${esc(h.by || '—')} · ${esc(h.t || '')}</small></div></div>`;
  const apRows = d => d.pend.slice(0, 3).map(({ r, i }) => `<div class="cz-ar"><span><b>${esc((r.items && r.items[0] && r.items[0].name) || r.id)}</b><small>${esc(r.division || '')} · ${esc(r.branch || '')}</small></span>${isGA() ? `<button class="cz-btn" onclick="CZ.rev(${i},'ok')">Approve</button><button class="cz-btn ghost" onclick="CZ.rev(${i},'no')">Deny</button>` : ''}</div>`).join('') || '<p class="cz-empty"><i class="fa-solid fa-circle-check"></i> Tidak ada permintaan menunggu.</p>';
  const alRows = d => { const t = d.tasks.slice(0, 3); if (d.imp) t.unshift({ i: 'fa-link', h: d.imp + ' item belum tersinkron dari permintaan', b: 'Sync Now', js: 'AM.sync()' });
    return t.slice(0, 3).map(x => `<div class="cz-ar"><span><b>${x.h}</b></span><button class="cz-btn ${x.b === 'Sync Now' ? '' : 'soft'}" onclick="${x.js}">${x.b}</button></div>`).join('') || '<p class="cz-empty"><i class="fa-solid fa-circle-check"></i> Semua beres.</p>'; };

  function trend(L) { const now = new Date(), v = [], lb = [];
    for (let i = 11; i >= 0; i--) { const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); lb.push(e.toLocaleDateString('id-ID', { month: 'short' })); v.push(L.filter(a => !dead(a) && a.date && new Date(a.date) <= e).reduce((s, a) => s + tot(a), 0)); }
    return { lb, v }; }
  function line(id, t) { const el = $(id); if (!el || !window.Chart) return; const g = el.getContext('2d').createLinearGradient(0, 0, 0, 220), ink = css('--chart-text') || '#6b4423';
    g.addColorStop(0, 'rgba(232,137,43,.45)'); g.addColorStop(1, 'rgba(232,137,43,.02)');
    AM.chart = new Chart(el, { type: 'line', data: { labels: t.lb, datasets: [{ data: t.v, borderColor: '#e8892b', backgroundColor: g, fill: true, tension: .4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + rp(c.parsed.y) } } }, scales: { x: { grid: { display: false }, ticks: { color: ink, maxTicksLimit: 4 } }, y: { display: false } } } }); }

  function bento(d) {
    const t = trend(d.L), f = t.v.find(x => x > 0) || 0, g = f ? Math.round((d.val - f) / f * 100) : 0, p = d.pend.length, ls = [['Baik', 'Good'], ['Maintenance', 'Maintenance'], ['Rusak', 'Broken'], ['Hilang', 'Lost'], ['Musnah', 'Disposed']], tt = Math.max(1, sq(d.L));
    const mtAl = d.L.filter(a => a.status === 'Maintenance' || a.status === 'Broken');
    return `<div class="cz-bento">
      <div class="cz-card cz-hero"><div class="cz-row"><span class="cz-chipc"><i class="fa-solid fa-boxes-stacked"></i><span><small>Jumlah Aset</small><b>${d.units}</b></span></span><span class="cz-chipc"><i class="fa-solid fa-chart-line"></i><span><small>Depresiasi</small><b>${d.dp}%</b></span></span></div>
        <small class="cz-mt">Total Nilai Aset (Aktif)</small><b class="cz-big">${rp(d.val)}</b><small>Nilai buku ${R2(d.book)} · ${d.act.length} jenis aset aktif</small>
        <div class="cz-chart">${f ? `<span class="cz-badge">${g >= 0 ? '↑' : '↓'} ${Math.abs(g)}%</span>` : ''}<canvas id="czC1"></canvas></div></div>
      <div class="cz-card cz-urg"><h3>Tindak Lanjut Mendesak</h3><div class="cz-ug"><span class="cz-tile"><i class="fa-solid fa-bell"></i></span><div>
        <button class="cz-nl" onclick="switchTab('list')"><em>${p}</em><span>Permintaan menunggu persetujuan</span></button><button class="cz-nl" onclick="AM.f.st='INCOMPLETE';AM.f.page=1;switchTab('areg')"><em>${d.inN}</em><span>Data aset belum lengkap</span></button></div></div></div>
      <div class="cz-card"><h3>Peringatan Maintenance</h3><button class="cz-al" onclick="switchTab('amtc')"><i class="fa-solid fa-triangle-exclamation"></i><em>${d.mt}</em><span>Aset sedang maintenance</span></button><button class="cz-al" onclick="switchTab('ainc')"><i class="fa-solid fa-triangle-exclamation"></i><em>${d.c('Broken')}</em><span>Aset rusak kritis</span></button></div>
      <div class="cz-card cz-brs"><h3>Status Cabang</h3>${d.br.slice(0, 4).map(b => `<div class="cz-bp">${dot(b.hs)}<b>${esc(b.n)}</b><span>${b.hs === 'bad' ? 'Ada masalah' : 'Operasional'} (${Math.round(b.h * 100)}%)</span><i><u style="width:${Math.round(b.h * 100)}%" data-h="${b.hs}"></u></i></div>`).join('') || '<p class="cz-empty">Belum ada data.</p>'}</div>
      <div class="cz-card cz-hlth"><h3>Rincian Kondisi Aset</h3><div class="cz-vb">${ls.map(([l, s]) => { const n = d.c(s), pc = Math.round(n / tt * 100); return `<div><i><u style="height:${Math.max(pc, n ? 6 : 0)}%"></u></i><b>${n}</b><span>${l}</span></div>`; }).join('')}</div></div>
      <div class="cz-card cz-feed"><h3>Aktivitas Terbaru</h3>${d.log.slice(0, 3).map(({ a, h }) => `<div class="cz-fi">${av(h.by)}<div><b>${esc(h.act || '')}</b><small>${esc(a.name)} · ${esc(h.by || '—')}</small></div></div>`).join('') || '<p class="cz-empty">Belum ada aktivitas.</p>'}</div></div>`;
  }

  function split(d) {
    const sel = d.br.find(b => b.n === AM.dashBr) || d.br[0]; if (!sel) return '<div class="cz-card"><p class="cz-empty">Belum ada aset.</p></div>'; AM.dashBr = sel.n;
    const cat = {}; sel.items.forEach(a => { const k = a.category || '(Belum dikategorikan)'; cat[k] = (cat[k] || 0) + q(a); });
    const lg = d.log.filter(x => (x.a.branch || '(Tanpa cabang)') === sel.n).slice(0, 5), stc = { Good: 'ok', Maintenance: 'warn', Broken: 'bad' };
    return `<div class="cz-split"><aside class="cz-master"><h2>Toko &amp; Cabang</h2><label class="cz-search"><i class="fa-solid fa-magnifying-glass"></i><input placeholder="Cari cabang..." oninput="CZ.f(this.value)"></label>
      <div class="cz-bl">${d.br.map((b, i) => `<button class="cz-bc ${b.n === sel.n ? 'on' : ''}" data-n="${esc(b.n.toLowerCase())}" onclick="CZ.br(${i})"><div class="cz-row">${pill(b.hs)}<b>${esc(b.n)}</b></div><div class="cz-m3"><div><small>Total Aset</small><b>${b.u}</b></div><div><small>Rata-rata Usia</small><b>${b.avg.toFixed(1)} thn</b></div><div><small>Maint. Terlambat</small><b>${b.od}</b></div></div></button>`).join('')}</div></aside>
      <section class="cz-detail"><div class="cz-row cz-dh"><h2>Detail Cabang: ${esc(sel.n)}</h2>${sw('split')}</div>
        <div class="cz-k4">${kcard('Total Aset (Unit)', sel.u, 'fa-boxes-stacked')}${kcard('Maintenance Cabang', sel.mt + ' aktif', 'fa-screwdriver-wrench')}${kcard('Nilai Aset', R2(sel.v), 'fa-wallet')}${kcard('Depresiasi', (sel.v ? Math.round((1 - sel.items.reduce((s, a) => s + dep(a).book, 0) / sel.v) * 100) : 0) + '%', 'fa-chart-line')}</div>
        <div class="cz-two"><div class="cz-card"><h3>Rincian Aset</h3><div class="cz-tblw"><table class="cz-tbl"><thead><tr><th>ID</th><th>Nama</th><th>Kategori</th><th>Status</th><th>Divisi</th><th>Tgl Beli</th></tr></thead><tbody>${sel.items.slice(0, 5).map(a => `<tr><td>${esc(a.id)}</td><td><b>${esc(a.name)}</b></td><td>${esc(a.category) || '—'}</td><td>${badge(a.status)}</td><td>${esc(a.division) || '—'}</td><td>${esc(a.date) || '—'}</td></tr>`).join('')}</tbody></table></div><button class="cz-link" onclick="AM.f.loc='${esc(sel.n).replace(/'/g, "\\'")}';AM.f.page=1;switchTab('areg')">Lihat semua di Registry →</button></div>
          <div class="cz-card"><h3>Aset per Kategori</h3>${bars(cat, 6)}</div></div>
        <div class="cz-card"><h3>Aktivitas Aset Terbaru</h3>${lg.map(tline).join('') || '<p class="cz-empty">Belum ada aktivitas.</p>'}</div></section></div>`;
  }

  function cmd(d) {
    return `<div class="cz-row cz-dh"><h2>Pusat Aksi</h2>${sw('cmd')}</div>
      <div class="cz-two eq"><div class="cz-card cz-out"><div class="cz-row"><div><h3>Menunggu Persetujuan</h3><small>${d.pend.length} permintaan baru</small></div><em class="cz-cnt">${d.pend.length}</em></div>${apRows(d)}<button class="cz-wide" onclick="switchTab('list')">Tinjau Semua Persetujuan</button></div>
        <div class="cz-card"><h3>Status Sinkron &amp; Peringatan</h3><small>${d.imp ? d.imp + ' item menunggu sinkron' : 'Semua permintaan Selesai sudah masuk registry'} <i class="fa-solid fa-circle-check cz-ok"></i></small><b class="cz-sm">Peringatan Aksi: ${d.tasks.length + (d.imp ? 1 : 0)} item</b>${alRows(d)}<button class="cz-wide" onclick="switchTab('aaud')">Lihat Log Audit</button></div></div>
      <div class="cz-k4">${kcard('Total Aset (Aktif)', d.units, 'fa-box')}${kcard('Nilai Perolehan', R2(d.val), 'fa-chart-line')}${kcard('Aset Maintenance', d.mt, 'fa-screwdriver-wrench')}${kcard('Aset Dimusnahkan', d.c('Disposed'), 'fa-fire')}</div>
      <div class="cz-two cmd"><div class="cz-card"><h3>Kategori Aset (Jumlah)</h3>${bars(d.cat, 7)}</div>
        <div class="cz-card"><h3>Log Aktivitas Aset Terbaru</h3><div class="cz-tblw"><table class="cz-tbl"><thead><tr><th>Waktu</th><th>Aset</th><th>User</th><th>Aksi</th><th>Lokasi</th></tr></thead><tbody>${d.log.slice(0, 5).map(({ a, h }) => `<tr><td>${esc(h.t || '')}</td><td><b>${esc(a.name)}</b><small>${esc(a.id)}</small></td><td class="cz-u">${av(h.by)}${esc(h.by || '—')}</td><td>${esc(h.act || '')}</td><td>${esc(a.branch) || '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="cz-empty">Belum ada aktivitas.</td></tr>'}</tbody></table></div></div></div>`;
  }

  function dash() {
    const d = data(), cur = lay(); ['chart', 'chart2'].forEach(k => { if (AM[k]) { try { AM[k].destroy(); } catch (e) {} AM[k] = null; } });
    $('view-adash').innerHTML = `<div class="cz-wrap cz-${cur}">${cur === 'bento' ? `<div class="cz-row cz-dh"><h2>Dashboard Aset</h2>${sw(cur)}</div>` : ''}${cur === 'split' ? split(d) : cur === 'cmd' ? cmd(d) : bento(d)}</div>`;
    if (cur === 'bento') line('czC1', trend(d.L));
  }
  window.dash = dash;
  window.CZ = { set(k) { try { localStorage.setItem(KEY, k); } catch (e) {} dash(); }, br(i) { const b = data().br[i]; if (b) { AM.dashBr = b.n; dash(); } },
    f(v) { v = v.toLowerCase(); document.querySelectorAll('.cz-bc').forEach(e => { e.style.display = e.dataset.n.includes(v) ? '' : 'none'; }); },
    rev(i, k) { if (!isGA()) return; openEditModal(i); const s = document.getElementById('editStatus'), v = k === 'no' ? 'Ditolak' : 'Approval Manager Ops'; if (s && [...s.options].some(o => o.value === v)) s.value = v; } };
  try { R.adash = dash; } catch (e) {}
})();
