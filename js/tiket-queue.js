/* Dashboard & Status Pengajuan Tiket — tampilan master-detail (antrean tiket + detail), sesuai mockup.
   Memakai data & fungsi lama (applyTableFilters, openEditModal, printRequest, openDetailModal). Tabel lama tetap ada tapi disembunyikan. */
(() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UR = { Critical: ['URGENT', 'urg'], High: ['HIGH', 'high'], Medium: ['MEDIUM', 'med'], Low: ['LOW', 'low'] };
  const ST = { Menunggu: 'pend', 'Approval Manager Ops': 'prog', 'Approval Finance': 'prog', Dikirim: 'prog', Diterima: 'done', Ditolak: 'rej' };
  const CH = [['all', 'Semua', () => setStatusTab(''), 'fa-list'], ['pend', 'Menunggu', () => setStatusTab('Menunggu'), 'fa-regular fa-clock'], ['urg', 'Urgent', () => setStatusTab('', true), 'fa-triangle-exclamation'], ['sent', 'Dikirim', () => setStatusTab('Dikirim'), 'fa-paper-plane'], ['done', 'Diterima', () => setStatusTab('Diterima'), 'fa-circle-check']];
  const cnt = { all: r => true, pend: r => r.status === 'Menunggu', urg: r => r.urgency === 'Critical' || r.urgency === 'High', sent: r => r.status === 'Dikirim', done: r => r.status === 'Diterima' };
  const T = { sel: null, cap: 40 };
  const reqs = () => appState.requests || [];
  const lab = s => (TSTAT[s] || {}).label || s;
  const act = () => ticketUrgentOnly ? 'urg' : ticketStatusFilter === '' ? 'all' : ticketStatusFilter === 'Menunggu' ? 'pend' : ticketStatusFilter === 'Dikirim' ? 'sent' : ticketStatusFilter === 'Diterima' ? 'done' : '';
  const money = r => (r.items || []).reduce((s, i) => s + (i.qty || 0) * (i.cost || 0), 0);
  const prog = r => { const i = TICKET_FLOW.indexOf(r.status), n = TICKET_FLOW.length, done = r.status === 'Diterima' ? n : Math.max(0, i); return { done, n, pct: Math.round(done / n * 100) }; };

  function shell() {
    const v = document.getElementById('view-list'); if (!v || document.getElementById('tq-root')) return !!v;
    v.classList.add('tq-on');
    v.insertAdjacentHTML('afterbegin', `<div id="tq-root" class="tq"><aside class="tq-q"><h2>Antrean Tiket</h2>
      <div class="tq-fr"><label class="tq-s"><i class="fa-solid fa-magnifying-glass"></i><input id="tqSearch" placeholder="Cari kode tiket atau pemohon..." oninput="TQ.search(this.value)"></label>
      <div class="tq-fw"><button type="button" id="tqFbtn" class="tq-fb" onclick="TQ.pop(event)" aria-haspopup="true" aria-expanded="false"></button><div id="tqPop" class="tq-pop" hidden></div></div></div><div id="tqList" class="tq-list"></div></aside><section id="tqDetail" class="tq-d"></section></div>`);
    return true;
  }
  const card = (r, on) => { const [ul, uc] = UR[r.urgency] || UR.Low, sc = ST[r.status] || 'pend';
    return `<button class="tq-c ${on ? 'on' : ''}" onclick="TQ.pick('${E(r.id)}')"><div class="tq-r"><div><b>${E(r.id)}</b><small><i class="fa-regular fa-calendar"></i> ${E(r.submissionDate)}</small></div><span class="tq-u" data-u="${uc}">${uc === 'urg' ? '<i class="fa-solid fa-triangle-exclamation"></i> ' : ''}${ul}</span></div>
      <p><span class="tq-av">${E(String(ticketApplicant(r)||"?").charAt(0).toUpperCase())}</span>${E(ticketApplicant(r))}</p><p><i class="fa-solid fa-location-dot"></i>${E(r.branch)}</p>
      <div class="tq-r"><span class="tq-p" data-s="${sc}">${E(lab(r.status))}</span><small><i class="fa-solid fa-list"></i> ${(r.items || []).length} item</small></div></button>`; };

  function detail(r) {
    const el = document.getElementById('tqDetail'); if (!r) { el.innerHTML = '<div class="tq-empty"><i class="fa-solid fa-ticket"></i><p>Pilih tiket di antrean untuk melihat detailnya.</p></div>'; return; }
    const idx = reqs().indexOf(r), p = prog(r), ga = getCurrentUser().role === 'General Affair Manager', it = r.items || [], fi = TICKET_FLOW.indexOf(r.status), nx = TICKET_FLOW[fi + 1];
    const last = (r.audit || []).slice(-1)[0] || {}, photos = it.filter(i => i.photo);
    const steps = TICKET_FLOW.map((s, i) => `<li class="${i < p.done || r.status === 'Diterima' ? 'ok' : ''}"><i class="fa-solid ${i < p.done ? 'fa-circle-check' : 'fa-circle-dot'}"></i>${E(lab(s))}</li>`).join('');
    el.innerHTML = `<div class="tq-r tq-dh"><h2>${E(r.id)}</h2>${ga ? `<button class="tq-ed" onclick="openEditModal(${idx})"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}</div>
      <div class="tq-4"><div><h4>Pemohon</h4><b>${E(ticketApplicant(r))}</b><small>Cabang: ${E(r.branch)}</small><small>Divisi: ${E(r.division)}</small></div>
        <div><h4>Detail Aset</h4><b>${it.length} item</b><small>${E((it[0] || {}).category || '-')}</small><small>Estimasi: ${formatRupiah(money(r))}</small></div>
        <div><h4>Tahap Saat Ini</h4><span class="tq-p" data-s="${ST[r.status] || 'pend'}"><i class="${(TSTAT[r.status] || {}).icon || ''}"></i> ${E(lab(r.status))}</span></div>
        <div><h4>Linimasa</h4><small>Dibuat</small><b>${E(r.submissionDate)}</b><small>Update: ${E(r.receivedAt || last.timestamp || '-')}</small></div></div>
      <h3>Progres Pengajuan</h3><div class="tq-pg"><b>Progres Tiket</b>${r.status === 'Ditolak' ? '<p class="tq-rej"><i class="fa-solid fa-circle-xmark"></i> Tiket ditolak</p>' : `<div class="tq-bar"><u style="width:${Math.max(p.pct, 8)}%">${p.pct}% selesai</u></div><small>${E(lab(r.status))}: ${p.done}/${p.n} tahap</small><ul class="tq-st">${steps}</ul>`}</div>
      <h3>Informasi Detail</h3>
      <details open><summary>Deskripsi Tiket</summary><p>${E(r.justification) || '-'}</p>${r.gaNotes ? `<p><b>Catatan GA:</b> ${E(r.gaNotes)}</p>` : ''}</details>
      <details><summary>Daftar Item (${it.length})</summary><div class="tq-it">${it.map(i => `<div><span><b>${E(i.name)}</b><small>${E(i.category)} · ${i.qty} ${E(i.unit)}${i.notes ? ' · ' + E(i.notes) : ''}</small></span><em>${formatRupiah((i.qty || 0) * (i.cost || 0))}</em></div>`).join('')}</div></details>
      <details><summary>Riwayat Aktivitas</summary><ul class="tq-h">${(r.audit || []).map(a => `<li><b>${E(a.action)}</b><small>${E(a.actor)} · ${E(a.timestamp)}</small></li>`).join('') || '<li>Belum ada riwayat.</li>'}</ul></details>
      <details><summary>Lampiran (${photos.length})</summary><div class="tq-ph">${photos.map(i => `<img src="${E(i.photo)}" alt="${E(i.name)}" onclick="openZoomImage(this.src)">`).join('') || '<small>Tidak ada lampiran.</small>'}</div></details>
      <div class="tq-act">${ga && nx && r.status !== 'Ditolak' ? `<button class="ap" onclick="TQ.go(${idx},'${E(nx)}')"><i class="fa-solid fa-circle-check"></i> Setujui</button>` : ''}${ga && r.status !== 'Ditolak' && r.status !== 'Diterima' ? `<button class="rj" onclick="TQ.go(${idx},'Ditolak')"><i class="fa-solid fa-xmark"></i> Tolak</button>` : ''}
        <button onclick="openDetailModal(${idx})"><i class="fa-solid fa-circle-info"></i> Lihat Detail</button><button onclick="printRequest(${idx})"><i class="fa-solid fa-print"></i> Cetak</button></div>`;
  }

  function render() {
    if (!shell()) return; const L = appState.pagination.filteredData || [];
    if (!T.sel || !L.some(r => r.id === T.sel)) T.sel = L[0] ? L[0].id : null;
    const all = (typeof getAccessibleRequests === 'function' ? getAccessibleRequests() : reqs()), a = act(), cur = CH.find(c => c[0] === a);
    document.getElementById('tqFbtn').innerHTML = `<i class="fa-solid fa-list-check"></i><span>Filter${cur && a !== 'all' ? ': <b>' + cur[1] + '</b>' : ''}</span><em>${L.length}</em><u>&#9662;</u>`;
    document.getElementById('tqFbtn').classList.toggle('on', a !== 'all');
    document.getElementById('tqPop').innerHTML = CH.map(([k, l, , ic]) => `<button class="${a === k ? 'on' : ''}" onclick="TQ.chip('${k}')"><i class="${ic.indexOf(' ') > 0 ? ic : 'fa-solid ' + ic}"></i><span>${l}</span><em>${all.filter(cnt[k]).length}</em>${a === k ? '<i class="fa-solid fa-circle-check tq-ck"></i>' : ''}</button>`).join('');
    const ls = document.getElementById('tqList'), top = ls.scrollTop;
    ls.innerHTML = L.length ? L.slice(0, T.cap).map(r => card(r, r.id === T.sel)).join('') + (L.length > T.cap ? `<button class="tq-more" onclick="TQ.more()">Muat lebih banyak (${L.length - T.cap})</button>` : '') : '<p class="tq-none">Belum ada tiket yang cocok.</p>';
    ls.scrollTop = top; detail(L.find(r => r.id === T.sel) || null);
  }
  window.TQ = { render,
    chip(k) { T.cap = 40; TQ.close(); (CH.find(c => c[0] === k) || CH[0])[2](); },
    pop(e) { e.stopPropagation(); const p = document.getElementById('tqPop'), o = p.hidden; p.hidden = !o; document.getElementById('tqFbtn').setAttribute('aria-expanded', String(o)); },
    close() { const p = document.getElementById('tqPop'); if (p) p.hidden = true; const b = document.getElementById('tqFbtn'); if (b) b.setAttribute('aria-expanded', 'false'); },
    search(v) { const s = document.getElementById('filterSearch'); if (s) s.value = v; T.cap = 40; applyTableFilters(); },
    pick(id) { T.sel = id; render(); if (window.innerWidth < 900) document.getElementById('tqDetail').scrollIntoView({ behavior: 'smooth' }); },
    more() { T.cap += 40; render(); },
    go(idx, st) { openEditModal(idx); const s = document.getElementById('editStatus'); if (s && [...s.options].some(o => o.value === st)) s.value = st; } };
  document.addEventListener('click', e => { if (!e.target.closest('.tq-fw')) TQ.close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') TQ.close(); });
  const orig = window.renderRequestsTable;
  window.renderRequestsTable = function () { const r = orig.apply(this, arguments); try { render(); } catch (e) { console.error('TQ', e); } return r; };
  document.addEventListener('DOMContentLoaded', () => { try { if (appState.pagination) render(); } catch (e) {} });
})();
