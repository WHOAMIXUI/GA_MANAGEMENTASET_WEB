/* Modul Aset: Vendor & Kontak Sales digabung dalam satu halaman.
   - Satu daftar, dengan penyaring Berkontrak / Tanpa Kontrak.
   - Data TIDAK dipindah: vendor tetap di AM.vendors, kontak sales tetap di AM.contacts
     (jadi data lama, backup, dan sinkron cloud tidak berubah). Hanya tampilannya yang disatukan.
   - Kontak sales kini juga bisa diberi status kontrak (field baru: kontrak, contractNo, start, expiry).
   Dimuat setelah 17-layout-v2.js; menggantikan tampilan lama menu "Manajemen Vendor" dan "Kontak Sales". */
(() => {
  const SKY = 'sky';
  const kindOf = r => r.k === 'v' ? vt(r.d) : (r.d.kontrak === 'contract' ? 'contract' : 'none');
  const recs = () => [
    ...AM.vendors.map(d => ({ k: 'v', d })),
    ...AM.contacts.map(d => ({ k: 'c', d }))
  ].map(r => ({ ...r, c: kindOf(r) }));

  const PAGE = 30;
  const state = () => { const f = AM.vf; if (!f.k) f.k = 'all'; if (f.s == null) f.s = ''; if (!f.t) f.t = 'all'; if (!f.n) f.n = PAGE; return f; };

  function contractBadge(r) {
    if (r.c === 'none') return `<span class="px-2 py-1 text-[10px] font-bold rounded border bg-slate-500/10 text-slate-300 border-slate-500/30 whitespace-nowrap">Tanpa Kontrak</span>`;
    if (!r.d.expiry) return `<span class="px-2 py-1 text-[10px] font-bold rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 whitespace-nowrap">Berkontrak</span>`;
    const d = days(r.d.expiry), c = d < 0 ? 'rose' : d <= 60 ? 'amber' : 'emerald';
    return `<span class="px-2 py-1 text-[10px] font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20 whitespace-nowrap">${d < 0 ? 'Kontrak berakhir' : d + ' hari lagi'}</span>`;
  }

  function contractLines(r) {
    const d = r.d;
    if (r.c === 'none') return `<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-solid fa-file-circle-xmark mr-1"></i>${r.k === 'v' ? 'Tidak terikat kontrak (per panggilan / per pekerjaan)' : 'Belum ada kontrak'}</p>`;
    return (d.expiry ? `<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${d.start ? esc(d.start) + ' s/d ' + esc(d.expiry) : 'Kontrak s/d ' + esc(d.expiry)}</p>` : '')
      + (d.contractNo ? `<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-solid fa-file-signature mr-1"></i>No. ${esc(d.contractNo)}</p>` : '');
  }

  const link = (href, ic, tt, cls, ext) => `<a href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''} title="${tt}" class="modern-button bg-cocoa-800 hover:bg-cocoa-900 ${cls} text-[11px] px-2.5 py-1.5 border border-white/5 ml-1 inline-block"><i class="${ic}"></i></a>`;

  function card(r) {
    const d = r.d, ga = isGA(), wa = waNum(d.phone), isV = r.k === 'v';
    let tag;
    if (isV) tag = `<p class="text-[11px] mt-2 font-bold text-${SKY}-400"><i class="fa-solid fa-handshake mr-1"></i>Vendor</p>`;
    else { const t = ctInfo(d.type); tag = `<p class="text-[11px] mt-2 font-bold text-${t[2]}-400"><i class="fa-solid ${t[1]} mr-1"></i>Sales · ${esc(t[0])}</p>`; }
    const st = !isV ? (CS[d.status] || CS.baru) : null;
    const edit = isV ? `AM.vendor('${d.id}')` : `AM.contact('${d.id}')`, del = isV ? `AM.delVendor('${d.id}')` : `AM.delContact('${d.id}')`;
    return `<div class="glass-panel p-5" style="content-visibility:auto;contain-intrinsic-size:auto 210px">
  <div class="flex justify-between items-start gap-2"><div class="min-w-0"><h3 class="font-bold text-white text-sm">${esc(d.name)}</h3>${!isV && d.company ? `<p class="text-xs text-dobah-200/70 mt-0.5">${esc(d.company)}</p>` : ''}</div>${contractBadge(r)}</div>
  ${tag}
  ${isV ? (d.service ? `<p class="text-xs text-dobah-200/80 mt-2">${esc(d.service)}</p>` : '') : (d.offer ? `<p class="text-xs text-dobah-200/80 mt-2">${esc(d.offer)}</p>` : '')}
  ${d.phone ? `<p class="text-xs text-dobah-200/60 mt-2"><i class="fa-solid fa-phone mr-1"></i>${esc(d.phone)}</p>` : ''}
  ${d.email ? `<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-regular fa-envelope mr-1"></i>${esc(d.email)}</p>` : ''}
  ${d.area ? `<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-solid fa-location-dot mr-1"></i>${esc(d.area)}</p>` : ''}
  ${contractLines(r)}
  ${st ? `<p class="mt-2"><span class="px-2 py-1 text-[10px] font-bold rounded border bg-${st[1]}-500/10 text-${st[1]}-400 border-${st[1]}-500/20 whitespace-nowrap">${st[0]}</span>${d.last ? `<span class="text-[11px] text-dobah-200/60 ml-2"><i class="fa-regular fa-calendar mr-1"></i>Kontak terakhir: ${esc(d.last)}</span>` : ''}</p>` : ''}
  ${d.note ? `<p class="text-[11px] text-dobah-200/60 mt-2 italic">${esc(d.note)}</p>` : ''}
  <div class="mt-3 flex flex-wrap items-center gap-y-1">${wa ? link('https://wa.me/' + wa, 'fa-brands fa-whatsapp', 'Chat WhatsApp', 'text-emerald-400', 1) : ''}${d.phone ? link('tel:' + esc(String(d.phone).replace(/[^\d+]/g, '')), 'fa-solid fa-phone', 'Telepon', 'text-dobah-300') : ''}${d.email ? link('mailto:' + esc(d.email), 'fa-regular fa-envelope', 'Kirim email', 'text-dobah-300') : ''}${ga ? btn(edit, 'fa-pen', 'Edit') + btn(del, 'fa-trash', 'Hapus', 'text-rose-400') : ''}</div></div>`;
  }

  const hay = r => [r.d.name, r.d.service, r.d.company, r.d.offer, r.d.phone, r.d.email, r.d.area, r.d.note, r.d.contractNo].join(' ').toLowerCase();
  function visible() {
    const f = state(), qq = (f.q || '').toLowerCase();
    return recs().filter(r =>
      (f.t === 'all' || r.c === f.t) &&
      (f.k === 'all' || (f.k === 'v' ? r.k === 'v' : (r.k === 'c' && (f.k === 'c' || r.d.type === f.k.slice(2))))) &&
      (!f.s || (r.k === 'c' && r.d.status === f.s)) &&
      (!qq || hay(r).includes(qq))
    ).sort((a, b) => {
      const ka = a.c === 'contract' && a.d.expiry ? days(a.d.expiry) : 1e9, kb = b.c === 'contract' && b.d.expiry ? days(b.d.expiry) : 1e9;
      return ka - kb || (b.d.ts || 0) - (a.d.ts || 0) || String(a.d.name || '').localeCompare(String(b.d.name || ''));
    });
  }
  function grid() {
    const el = $('amVkGrid'); if (!el) return;
    const f = state(), L = visible(), none = AM.vendors.length + AM.contacts.length === 0, shown = L.slice(0, f.n);
    const more = L.length > shown.length ? `<div class="md:col-span-2 xl:col-span-3 flex flex-col items-center gap-2 py-3"><p class="text-[11px] text-dobah-200/60">Menampilkan ${shown.length} dari ${L.length} data</p><button onclick="AM.vkMore()" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-5 py-2.5">Tampilkan ${Math.min(PAGE, L.length - shown.length)} lagi</button></div>` : '';
    el.innerHTML = L.length ? shown.map(card).join('') + more
      : `<div class="glass-panel p-10 text-center text-dobah-200/50 italic md:col-span-2 xl:col-span-3">${none ? 'Belum ada data. Klik “Tambah Vendor” atau “Tambah Kontak Sales”.' : 'Tidak ada data pada filter ini.'}</div>`;
  }

  function view() {
    const ga = isGA(), f = state(), A = recs(), nC = A.filter(r => r.c === 'contract').length, nN = A.length - nC,
      soon = A.filter(r => r.c === 'contract' && r.d.expiry && days(r.d.expiry) <= 60).length,
      fu = AM.contacts.filter(c => c.status === 'baru' || c.status === 'dihubungi').length;
    if (f.k.startsWith('c:') && !ctList().some(t => t.id === f.k.slice(2))) f.k = 'all';
    const tabs = [['all', 'Semua (' + A.length + ')'], ['contract', 'Berkontrak (' + nC + ')'], ['none', 'Tanpa Kontrak (' + nN + ')']]
      .map(([k, l]) => `<button onclick="AM.vkTab('${k}')" class="modern-button text-xs font-bold px-4 py-2 border ${f.t === k ? 'bg-dobah-400 text-cocoa-950 border-dobah-400' : 'bg-cocoa-800 text-dobah-200 border-white/10'}">${l}</button>`).join('');
    const kopt = [['all', 'Semua (vendor & sales)'], ['v', 'Vendor (' + AM.vendors.length + ')'], ['c', 'Semua Kontak Sales (' + AM.contacts.length + ')']]
      .concat(ctList().map(t => ['c:' + t.id, '— ' + t.label + ' (' + AM.contacts.filter(c => c.type === t.id).length + ')']));
    $('view-aven').innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">${kpi('Total Vendor & Kontak', A.length, 'fa-handshake')}${kpi('Berkontrak', nC, 'fa-file-signature', 'emerald')}${kpi('Tanpa Kontrak', nN, 'fa-file-circle-xmark', 'slate')}${kpi('Kontrak ≤ 60 hari', soon, 'fa-hourglass-half', 'amber')}${kpi('Perlu Follow-up Sales', fu, 'fa-phone-volume', 'rose')}</div>
 <div class="flex flex-wrap justify-between items-center gap-3"><div class="flex gap-2 flex-wrap">${tabs}</div><div class="flex gap-2 flex-wrap">${ga ? `<button onclick="AM.cBulk()" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-4 py-2"><i class="fa-solid fa-file-arrow-up mr-1"></i>Upload Massal Sales</button>` : ''}<button onclick="AM.vkExport()" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-4 py-2"><i class="fa-solid fa-file-excel mr-1"></i>Download Excel</button>${ga ? `<button onclick="AM.vendor()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-plus mr-1"></i>Tambah Vendor</button><button onclick="AM.contact()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-plus mr-1"></i>Tambah Kontak Sales</button>` : ''}</div></div>
 <div class="glass-panel p-4 flex flex-col sm:flex-row gap-3"><input placeholder="Cari nama / perusahaan / layanan / penawaran / telepon..." value="${esc(f.q)}" oninput="AM.vkQ(this.value)" class="flex-1 glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold">
  <select onchange="AM.vkK(this.value)" class="glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold">${kopt.map(([k, l]) => `<option value="${esc(k)}" class="bg-cocoa-900" ${f.k === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
  <select onchange="AM.vkS(this.value)" class="glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold"><option value="" class="bg-cocoa-900">Semua Status Follow-up</option>${Object.entries(CS).map(([k, v]) => `<option value="${k}" class="bg-cocoa-900" ${f.s === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
 <div id="amVkGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>`;
    grid();
  }
  let qT;
  AM.vkTab = k => { const f = state(); f.t = k; f.n = PAGE; view(); };
  AM.vkQ = v => { const f = state(); f.q = v; clearTimeout(qT); qT = setTimeout(() => { f.n = PAGE; grid(); }, 220); };   // tunda sedikit agar mengetik tidak patah-patah
  AM.vkK = v => { const f = state(); f.k = v; f.n = PAGE; grid(); };
  AM.vkS = v => { const f = state(); f.s = v; f.n = PAGE; grid(); };
  AM.vkMore = () => { const f = state(); f.n += PAGE; grid(); };

  /* ---- form Kontak Sales: ditambah status kontrak (sama seperti vendor) ---- */
  AM.contact = async function (id) {
    if (!isGA()) return deny();
    const c = AM.contacts.find(x => x.id === id) || {};
    if (!ctList().length) return Swal.fire({ title: 'Belum ada jenis kontak', text: 'Tambahkan dulu di menu Master Data & Akun, bagian “Jenis kontak sales”.', icon: 'info', background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' });
    const r = await ask(id ? 'Edit Kontak Sales' : 'Tambah Kontak Sales', [
      { k: 'type', l: 'Jenis', v: (ctList().some(t => t.id === c.type) ? c.type : ctList()[0].id), opts: ctList().map(t => [t.id, t.label]) },
      { k: 'name', l: 'Nama sales / kontak', v: c.name, req: 1 },
      { k: 'company', l: 'Perusahaan / pemilik / agen', v: c.company },
      { k: 'offer', l: 'Yang ditawarkan (lokasi, mesin, harga, dll)', v: c.offer },
      { k: 'phone', l: 'Telepon / WhatsApp', t: 'tel', v: c.phone },
      { k: 'email', l: 'Email', t: 'email', v: c.email },
      { k: 'area', l: 'Alamat / area', v: c.area },
      { k: 'status', l: 'Status follow-up', v: c.status || 'baru', opts: Object.entries(CS).map(([k, v]) => [k, v[0]]) },
      { k: 'last', l: 'Tanggal kontak terakhir', t: 'date', v: c.last || today() },
      { k: 'kontrak', l: 'Status kerja sama', v: c.kontrak === 'contract' ? 'contract' : 'none', opts: [['none', 'Tanpa kontrak'], ['contract', 'Ada kontrak']] },
      { k: 'contractNo', l: 'No. kontrak (opsional)', v: c.contractNo },
      { k: 'start', l: 'Kontrak mulai', t: 'date', v: c.start || '' },
      { k: 'expiry', l: 'Kontrak berakhir', t: 'date', v: c.expiry || '' },
      { k: 'note', l: 'Catatan', v: c.note }], 'Simpan', {
      open: () => { const t = $('sw_kontrak'), sync = () => { const off = t.value === 'none'; ['contractNo', 'start', 'expiry'].forEach(k => { const e = $('sw_' + k); e.disabled = off; e.style.opacity = off ? .35 : 1; }); }; t.onchange = sync; sync(); },
      check: o => {
        if (!o.phone && !o.email) return 'Isi minimal telepon / WhatsApp atau email';
        if (o.kontrak === 'contract') { if (!o.expiry) return 'Tanggal berakhir kontrak wajib diisi'; if (o.start && o.start > o.expiry) return 'Tanggal mulai tidak boleh setelah tanggal berakhir'; }
        return '';
      }
    });
    if (!r) return;
    if (r.kontrak === 'none') { r.contractNo = ''; r.start = ''; r.expiry = ''; }
    if (id) Object.assign(c, r); else AM.contacts.push({ id: 'CTK-' + Date.now().toString(36).toUpperCase(), ts: Date.now(), ...r });
    save();
  };

  /* ---- Download Excel gabungan ---- */
  AM.vkExport = function () {
    const L = visible();
    if (!L.length) return Swal.fire({ title: 'Belum ada data', icon: 'info', background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' });
    return xlsDownload('vendor-kontak-sales', 'Vendor & Kontak',
      ['Kategori', 'Jenis', 'Nama', 'Perusahaan', 'Layanan / Penawaran', 'Telepon', 'Email', 'Alamat / Area', 'Status Kontrak', 'No. Kontrak', 'Kontrak Mulai', 'Kontrak Berakhir', 'Sisa Hari', 'Status Follow-up', 'Kontak Terakhir', 'Catatan'],
      L.map(r => { const d = r.d, k = r.c === 'contract', v = r.k === 'v';
        return [v ? 'Vendor' : 'Kontak Sales', v ? '' : ctInfo(d.type)[0], d.name || '', v ? '' : (d.company || ''), v ? (d.service || '') : (d.offer || ''), d.phone || '', d.email || '', d.area || '',
          k ? 'Berkontrak' : 'Tanpa Kontrak', k ? (d.contractNo || '') : '', k ? (d.start || '') : '', k ? (d.expiry || '') : '', (k && d.expiry) ? days(d.expiry) : '',
          v ? '' : (CS[d.status] || CS.baru)[0], v ? '' : (d.last || ''), d.note || ''];
      }), [14, 22, 26, 26, 36, 18, 26, 28, 16, 18, 14, 16, 10, 18, 16, 36]);
  };

  // pasang sebagai tampilan menu Vendor (dan Kontak Sales lama diarahkan ke sini)
  R.aven = view; R.acon = view;
})();
