/* Modul Aset: Lampiran dokumen (invoice, garansi, berita acara serah terima, dll).

   Penyimpanan mengikuti pola foto bukti pemusnahan yang sudah ada: isi file disimpan di koleksi Firestore
   `asset_photos` (aturan keamanannya sudah ada), dipecah jadi potongan <=700 KB per dokumen. Yang masuk ke
   registry aset hanya metadata kecil di a.files[] (nama, jenis, ukuran, tanggal, pengunggah), jadi dokumen
   registry tidak membengkak dan perubahan lampiran ikut tercatat di Audit Log.
   Foto/gambar dikompres di browser (sisi terpanjang 1600 px). Batas ukuran file: 3 MB. */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const ATT = window.ATT = { mem: {} };
  const KINDS = ['Invoice', 'Garansi', 'Berita Acara Serah Terima', 'Kontrak / Perjanjian', 'Foto Kondisi', 'Lainnya'];
  const MAX = 3 * 1024 * 1024, CH = 700000, OK_TYPES = /^(image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel)/;
  const who = () => (user() || {}).name || 'System';
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

  function readFile(f) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('baca file gagal')); r.readAsDataURL(f); }); }
  function shrinkImg(f) {
    return new Promise((ok, no) => {
      const im = new Image(), u = URL.createObjectURL(f);
      im.onload = () => { URL.revokeObjectURL(u); const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75)); };
      im.onerror = () => no(new Error('gambar tidak bisa dibaca')); im.src = u;
    });
  }

  async function putChunks(fid, dataUrl, onProgress) {
    const { setDoc, doc } = window.fbDeps, n = Math.ceil(dataUrl.length / CH), done = [];
    try {
      for (let i = 0; i < n; i++) {
        await timeout(setDoc(doc(window.db, 'asset_photos', `${fid}_${i}`), { data: dataUrl.slice(i * CH, (i + 1) * CH), ts: Date.now(), by: who(), kind: 'att' }), 25000);
        done.push(i); onProgress && onProgress((i + 1) / n);
      }
    } catch (e) { await dropChunks(fid, done.length + 1); throw e; }
    return n;
  }
  async function dropChunks(fid, n) { if (!window.db) return; const { deleteDoc, doc } = window.fbDeps; for (let i = 0; i < n; i++) { try { await deleteDoc(doc(window.db, 'asset_photos', `${fid}_${i}`)); } catch (e) {} } }
  async function getData(f) {
    if (ATT.mem[f.id]) return ATT.mem[f.id];
    const { getDoc, doc } = window.fbDeps; let s = '';
    for (let i = 0; i < f.chunks; i++) { const d = await timeout(getDoc(doc(window.db, 'asset_photos', `${f.id}_${i}`)), 25000); if (!d.exists()) throw new Error('potongan file hilang'); s += d.data().data; }
    return (ATT.mem[f.id] = s);
  }
  const dataToBlob = async u => (await fetch(u)).blob();

  /* ---------- dialog daftar + unggah ---------- */
  ATT.open = async function (aid) {
    const a = find(aid); if (!a) return; const files = a.files || [], ga = isGA();
    const list = files.length ? files.slice().reverse().map(f => `<div class="ga-file-row"><div class="min-w-0"><div class="font-bold text-white text-xs break-words">${esc(f.name)}</div>
      <div class="text-[11px] text-dobah-200/60">${esc(f.kind)} · ${kb(f.size)} · ${esc(f.date)} · ${esc(f.by)}${f.exp ? ' · garansi s/d ' + esc(f.exp) : ''}${f.note ? '<br>' + esc(f.note) : ''}</div></div>
      <div class="whitespace-nowrap">${btn(`ATT.view('${aid}','${f.id}')`, 'fa-download', 'Buka / unduh')}${ga ? btn(`ATT.del('${aid}','${f.id}')`, 'fa-trash-can', 'Hapus', 'text-rose-400') : ''}</div></div>`).join('')
      : '<p class="text-xs italic text-dobah-200/50 py-3">Belum ada lampiran.</p>';
    const inp = 'w-full px-3 py-2 text-sm rounded-lg bg-[#150a05] border border-white/10 text-white';
    const r = await Swal.fire({
      title: 'Lampiran', width: 560, ...SW, showCancelButton: true, confirmButtonText: 'Unggah', cancelButtonText: 'Tutup',
      html: `<div class="text-left text-xs"><p class="text-dobah-200/70 mb-2">${esc(a.name)} <span class="font-mono">(${esc(a.id)})</span></p><div class="space-y-2 max-h-56 overflow-y-auto mb-4">${list}</div>
        <div class="border-t border-white/10 pt-3"><b class="text-[#edd5b3]">Tambah lampiran</b>
        <label class="block font-bold mb-1 mt-2 text-[#edd5b3]">Jenis</label><select id="atK" class="${inp}">${KINDS.map(k => `<option>${k}</option>`).join('')}</select>
        <label class="block font-bold mb-1 mt-2 text-[#edd5b3]">File (foto, PDF, Word, Excel · maks 3 MB)</label><input id="atF" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" class="${inp}">
        <label class="block font-bold mb-1 mt-2 text-[#edd5b3]">Garansi berlaku sampai (opsional)</label><input id="atE" type="date" class="${inp}">
        <label class="block font-bold mb-1 mt-2 text-[#edd5b3]">Catatan (opsional)</label><input id="atN" class="${inp}" maxlength="120"></div></div>`,
      preConfirm: () => {
        const f = $('atF').files[0]; if (!f) { Swal.showValidationMessage('Pilih file dulu'); return false; }
        if (!(OK_TYPES.test(f.type) || /\.(docx?|xlsx?)$/i.test(f.name))) { Swal.showValidationMessage('Jenis file tidak didukung'); return false; }
        if (!f.type.startsWith('image/') && f.size > MAX) { Swal.showValidationMessage('Ukuran file maksimal 3 MB'); return false; }
        return { f, kind: $('atK').value, exp: $('atE').value, note: $('atN').value.trim() };
      }
    });
    if (r.isConfirmed) return ATT.upload(aid, r.value);
  };

  ATT.upload = async function (aid, { f, kind, exp, note }) {
    const a = find(aid); if (!a) return;
    if (!window.db || !navigator.onLine) return Swal.fire({ title: 'Perlu koneksi', text: 'Unggah lampiran memerlukan internet. Coba lagi saat online.', icon: 'info', ...SW });
    Swal.fire({ title: 'Mengunggah...', html: '<div class="ga-bar mt-2"><span id="atBar" style="width:0%"></span></div><p id="atTxt" class="text-xs mt-2 text-dobah-200/70">Menyiapkan file</p>', allowOutsideClick: false, showConfirmButton: false, ...SW });
    try {
      const url = f.type.startsWith('image/') ? await shrinkImg(f) : await readFile(f);
      if (url.length * 0.75 > MAX * 1.4) throw new Error('Ukuran file terlalu besar setelah diproses');
      const fid = 'AT-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const chunks = await putChunks(fid, url, p => { const b = $('atBar'), t = $('atTxt'); if (b) b.style.width = Math.round(p * 100) + '%'; if (t) t.textContent = Math.round(p * 100) + '%'; });
      const name = f.type.startsWith('image/') ? f.name.replace(/\.[^.]+$/, '') + '.jpg' : f.name;
      (a.files = a.files || []).push({ id: fid, name, kind, type: f.type.startsWith('image/') ? 'image/jpeg' : f.type, size: Math.round(url.length * 0.75), date: today(), by: who(), chunks, exp: exp || '', note });
      ATT.mem[fid] = url;
      hist(a, `Lampiran ditambahkan: ${kind} — ${name}`);
      await save();
      Swal.close(); ATT.open(aid);
    } catch (e) {
      console.error(e);
      Swal.fire({ title: 'Gagal mengunggah', text: e.message === 'timeout' ? 'Koneksi terlalu lambat. Coba lagi saat sinyal lebih baik.' : (e.message || 'Terjadi kesalahan'), icon: 'error', ...SW });
    }
  };

  ATT.view = async function (aid, fid) {
    const a = find(aid), f = a && (a.files || []).find(x => x.id === fid); if (!f) return;
    Swal.fire({ title: 'Memuat file...', ...SW, didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const url = await getData(f);
      if (/^image\//.test(f.type)) {
        const r = await Swal.fire({ title: esc(f.name), html: `<img src="${url}" class="w-full rounded-lg border border-white/10">`, showCancelButton: true, confirmButtonText: 'Unduh', cancelButtonText: 'Kembali', width: 720, ...SW });
        if (r.isConfirmed) GAX.download(f.name, await dataToBlob(url));
      } else { GAX.download(f.name, await dataToBlob(url)); Swal.close(); }
    } catch (e) {
      Swal.fire({ title: 'File tidak bisa dibuka', text: navigator.onLine ? 'File tidak ditemukan atau akses ditolak.' : 'Perlu koneksi internet untuk membuka lampiran.', icon: 'error', ...SW });
    }
  };

  ATT.del = async function (aid, fid) {
    if (!isGA()) return deny();
    const a = find(aid), f = a && (a.files || []).find(x => x.id === fid); if (!f) return;
    if (!(await confirmBox('Hapus lampiran?', f.name))) return;
    a.files = a.files.filter(x => x.id !== fid); delete ATT.mem[fid];
    hist(a, `Lampiran dihapus: ${f.kind} — ${f.name}`);
    await save(); dropChunks(fid, f.chunks); ATT.open(aid);
  };

  // dipakai Backup: hitung total lampiran
  ATT.count = () => AM.assets.reduce((n, a) => n + (a.files || []).length, 0);

  /* ---------- pengingat garansi (GA) ---------- */
  function warranty() {
    if (!isGA() || !AM.loaded) return; const st = nload(); if (!st) return; NC.fresh = [];
    AM.assets.forEach(a => (a.files || []).forEach(f => {
      if (!f.exp || dead(a)) return; const d = days(f.exp), b = d < 0 ? 'exp' : d <= 7 ? '7' : d <= 14 ? '14' : d <= 30 ? '30' : null; if (!b) return;
      add({ key: `wr|${a.id}|${f.id}|${b}`, type: 'vendor', level: d <= 7 ? 'danger' : 'warn', tab: 'areg', title: d < 0 ? 'Garansi aset sudah berakhir' : 'Garansi aset segera berakhir', msg: `${a.name} · ${a.branch || '-'} · ${d < 0 ? 'berakhir ' + (-d) + ' hari lalu' : d + ' hari lagi'} (${f.exp})` });
    }));
    if (NC.fresh.length) { nsave(); ui(); announce(NC.fresh); }
  }
  const _scan = NC.scan; NC.scan = function () { _scan.apply(this, arguments); try { warranty(); } catch (e) { console.error(e); } };
})();
