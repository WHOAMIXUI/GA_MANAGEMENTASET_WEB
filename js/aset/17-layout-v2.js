/* Modul Aset: penyimpanan "layout baru" supaya banyak orang bisa mengedit bersamaan.

   Layout lama (v1): semua aset ada di satu dokumen, setiap save() menulis ulang semuanya -> yang menyimpan
   terakhir menimpa perubahan orang lain.

   Layout baru:
   - v2: aset  -> asset_items/<id>   (satu dokumen per aset)
   - v3: + peminjaman, insiden, pasar, jual-beli, vendor, kontak -> asset_loans, asset_incidents, asset_market,
         asset_trades, asset_vendors, asset_contacts (juga satu dokumen per catatan)
   - settings/asset_registry tinggal menyimpan `life` (umur ekonomis) pada v3.
   - settings/asset_layout = penanda { v: 2 | 3 }. Tanpa penanda, aplikasi memakai layout lama.

   Aturan penggabungan agar edit bersamaan tidak saling menimpa:
   1. save() hanya menulis catatan yang BERUBAH, dan hanya KOLOM yang berubah (updateDoc). Dua orang yang mengubah
      kolom berbeda pada catatan yang sama keduanya tersimpan.
   2. Kolom array `history` dan `files` ditulis sebagai arrayUnion: entri baru dari dua orang digabung, bukan ditimpa.
   3. Saat perubahan orang lain masuk ke catatan yang sedang Anda edit (belum disimpan), perubahan Anda
      digabung di atas versi terbaru (rebase), bukan dibuang.
   4. Batas yang tersisa: dua orang mengubah KOLOM YANG SAMA pada catatan yang SAMA di waktu hampir bersamaan
      -> yang menyimpan terakhir yang menang (untuk kolom itu saja).

   Hook ada di 01-core.js (doWrite, applyCloudNow, subscribe). Data lama tidak dihapus (cadangan beku).

   BARU - Brankas harga (AM.pv): kolom `price` aset dipindah ke koleksi asset_values/<id aset> yang hanya boleh
   dibaca/ditulis GA (lihat firestore.rules). Dokumen asset_items tidak lagi memuat harga, jadi staf tidak bisa
   membacanya dari database. Di layar GA, harga digabung kembali ke objek aset (a.price) sehingga seluruh kode lain
   tidak perlu diubah. Aktif setelah GA menjalankan "Pisahkan Harga" (settings/asset_layout.pv = 1). */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const BATCH = 400, FLAG = 'ga_layout', PVF = 'ga_pv';
  const KINDS = {
    assets: { col: 'asset_items', arr: 'assets', label: 'aset' },
    loans: { col: 'asset_loans', arr: 'loans', label: 'peminjaman' },
    incidents: { col: 'asset_incidents', arr: 'incidents', label: 'insiden' },
    market: { col: 'asset_market', arr: 'market', label: 'penawaran pasar' },
    trades: { col: 'asset_trades', arr: 'trades', label: 'jual-beli' },
    vendors: { col: 'asset_vendors', arr: 'vendors', label: 'vendor' },
    contacts: { col: 'asset_contacts', arr: 'contacts', label: 'kontak' },
    // Brankas harga: bukan bagian dari ALL; hanya aktif bila AM.pv dan pengguna adalah GA (lihat active()).
    values: { col: 'asset_values', arr: 'values', label: 'nilai aset' }
  };
  const ALL = ['assets', 'loans', 'incidents', 'market', 'trades', 'vendors', 'contacts'];
  const V2 = window.V2 = {};
  const lvl0 = parseInt(localStorage.getItem(FLAG) || '0') || 0;
  AM.v2 = lvl0 >= 2; AM.v3 = lvl0 >= 3; AM._msig = '';
  let pv0 = ''; try { pv0 = localStorage.getItem(PVF) || ''; } catch (e) {}
  AM.pv = AM.v3 && pv0 === '1'; AM.values = [];
  const level = () => AM.v3 ? 3 : AM.v2 ? 2 : 0;
  // Brankas harga hanya dipakai GA. Staf tidak memuat/menulisnya (aturan Firestore menolak) dan objek asetnya memang tanpa harga.
  const usePV = () => !!(AM.pv && AM.v3 && isGA());
  // Penawaran pasar & jual-beli memuat harga: hanya GA yang membaca/menulisnya (aturan Firestore melarang staf).
  const GA_KINDS = ['market', 'trades'];
  const active = () => AM.v3 ? (isGA() ? ALL : ALL.filter(k => !GA_KINDS.includes(k))).concat(usePV() ? ['values'] : []) : AM.v2 ? ['assets'] : [];
  // LP = harga terakhir yang diketahui cocok dengan server (dibaca dari asset_values atau baru kita tulis). Dipakai
  // untuk membedakan "harga yang sedang saya edit dan belum tersimpan" dari "harga lama yang basi".
  const LP = new Map();
  const noPrice = r => { if (!r || !('price' in r)) return r; const o = Object.assign({}, r); delete o.price; return o; };
  const view = (kind, r) => (kind === 'assets' && AM.pv) ? noPrice(r) : r; // bentuk yang disimpan di asset_items
  const S = {}; Object.keys(KINDS).forEach(k => { S[k] = { ad: {}, sync: new Map(), base: new Map(), ready: false }; });

  // JSON kanonik (kunci diurutkan) supaya urutan kunci tidak dianggap perubahan
  const J = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const key = id => { let k = encodeURIComponent(String(id)); if (/^\.+$/.test(k) || k.startsWith('__')) k = 'a_' + k; return k.slice(0, 400); };
  const byC = (a, b) => ((a._c || 0) - (b._c || 0)) || String(a.id).localeCompare(String(b.id));
  const setFlag = n => { try { n ? localStorage.setItem(FLAG, String(n)) : localStorage.removeItem(FLAG); } catch (e) {} };
  const setPv = n => { try { n ? localStorage.setItem(PVF, '1') : localStorage.removeItem(PVF); } catch (e) {} };
  const errOf = e => String((e && (e.code || e.message)) || e || 'tidak diketahui');
  const mainObj = () => AM.v3 ? { life: AM.life } : { vendors: AM.vendors, contacts: AM.contacts, life: AM.life, loans: AM.loans, market: AM.market, trades: AM.trades, incidents: AM.incidents };

  /* ---------- selisih per kolom ---------- */
  function diffFields(base, a) {
    const set = {}, del = [], append = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(a)])) {
      if (k === 'id') continue;
      const x = base[k], y = a[k]; if (J(x) === J(y)) continue;
      if (y === undefined) { del.push(k); continue; }
      if ((k === 'history' || k === 'files') && Array.isArray(x) && Array.isArray(y) && y.length > x.length && x.every((e, i) => J(e) === J(y[i]))) { append[k] = y.slice(x.length); continue; }
      set[k] = y;
    }
    return { set, del, append };
  }
  const isEmpty = d => !Object.keys(d.set).length && !d.del.length && !Object.keys(d.append).length;
  function toPatch(d) {
    const { deleteField, arrayUnion } = window.fbDeps, p = {};
    for (const k in d.set) p[k] = clone(d.set[k]);
    d.del.forEach(k => { p[k] = deleteField(); });
    for (const k in d.append) p[k] = arrayUnion(...clone(d.append[k]));
    return p;
  }
  function applyDiff(obj, d) {
    const o = clone(obj);
    for (const k in d.set) o[k] = clone(d.set[k]);
    d.del.forEach(k => { delete o[k]; });
    for (const k in d.append) { const cur = Array.isArray(o[k]) ? o[k] : [], have = new Set(cur.map(J)); o[k] = cur.concat(clone(d.append[k]).filter(e => !have.has(J(e)))); }
    return o;
  }

  /* ---------- tulis: hanya yang berubah, hanya kolom yang berubah ---------- */
  V2.write = async function () {
    const { doc, setDoc, writeBatch } = window.fbDeps, db = window.db, act = active();
    for (let i = 0; i < 24 && act.some(k => !S[k].ready); i++) await new Promise(r => setTimeout(r, 250)); // beri waktu ±6 dtk
    if (act.some(k => !S[k].ready)) { AM.cloudErr = 'data cloud belum selesai dimuat (' + act.filter(k => !S[k].ready).map(k => KINDS[k].col).join(', ') + ')'; return false; }
    try {
      const ops = [];
      if (usePV()) { // turunkan daftar harga dari aset (harga yang belum pernah dibaca dari server tetap memakai nilai terakhir yang diketahui)
        AM.values = [];
        AM.assets.forEach(a => { if (!a || !a.id) return; const p = (a.price !== undefined && a.price !== null) ? Number(a.price) || 0 : LP.get(a.id); if (p !== undefined) AM.values.push({ id: a.id, price: p, _c: 1 }); });
      }
      for (const kind of act) {
        const s = S[kind], arr = AM[KINDS[kind].arr], seen = new Set(); let mx = 0;
        arr.forEach(r => { if (r._c > mx) mx = r._c; });
        arr.forEach(r => {
          if (!r.id) r.id = kind.slice(0, 3).toUpperCase() + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          if (!r._c) r._c = ++mx;
          const vr = view(kind, r), j = J(vr); seen.add(r.id); if (s.sync.get(r.id) === j) return;
          const base = s.base.get(r.id);
          if (!base) { ops.push({ kind, t: 'set', r, j }); return; }
          const d = diffFields(base, vr); if (isEmpty(d)) { s.sync.set(r.id, j); return; }
          ops.push({ kind, t: 'upd', r, j, d });
        });
        s.sync.forEach((j, id) => { if (!seen.has(id)) ops.push({ kind, t: 'del', id }); });
      }
      // cache lokal diperbarui SEKARANG supaya gema/perubahan dari server tidak menimpa edit yang belum terkirim
      ops.forEach(o => { const ad = S[o.kind].ad; if (o.t === 'del') delete ad[key(o.id)]; else ad[key(o.r.id)] = o.r; });
      const build = (chunk, forceSet) => {
        const b = writeBatch(db);
        chunk.forEach(o => {
          const col = KINDS[o.kind].col;
          if (o.t === 'del') b.delete(doc(db, col, key(o.id)));
          else if (o.t === 'upd' && !forceSet) b.update(doc(db, col, key(o.r.id)), toPatch(o.d));
          else b.set(doc(db, col, key(o.r.id)), JSON.parse(o.j));
        });
        return b;
      };
      for (let i = 0; i < ops.length; i += BATCH) {
        const chunk = ops.slice(i, i + BATCH);
        try { await build(chunk, false).commit(); }
        catch (e) { if (/not-found/.test(errOf(e))) await build(chunk, true).commit(); else throw e; } // dokumen sudah dihapus orang lain: tulis penuh
        chunk.forEach(o => { const s = S[o.kind]; if (o.t === 'del') { s.sync.delete(o.id); s.base.delete(o.id); if (o.kind === 'values') LP.delete(o.id); } else { s.sync.set(o.r.id, o.j); s.base.set(o.r.id, JSON.parse(o.j)); if (o.kind === 'values') LP.set(o.r.id, o.r.price); } });
      }
      const sig = J(mainObj());
      // Dokumen pengaturan utama hanya boleh ditulis GA (lihat firestore.rules); staf cukup menulis catatan per cabangnya.
      if (sig !== AM._msig && !isGA()) AM._msig = sig;
      else if (sig !== AM._msig) { await setDoc(doc(db, 'settings', 'asset_registry'), { ...JSON.parse(sig), ts: Date.now() }, { merge: true }); AM._msig = sig; }
      AM.cloudErr = ''; return true;
    } catch (e) { AM.cloudErr = errOf(e); console.error('Simpan cloud gagal:', e); return false; }
  };

  /* ---------- terima perubahan dari cloud ---------- */
  function ingest(kind, k, server) {
    const s = S[kind], cur = s.ad[k], id = server.id, base = s.base.get(id); let next = server;
    const vc = cur && view(kind, cur);
    if (cur && base && J(vc) !== s.sync.get(id)) { // ada edit lokal yang belum tersimpan: gabungkan di atas versi terbaru
      const d = diffFields(base, vc); if (!isEmpty(d)) next = applyDiff(server, d);
    }
    if (kind === 'assets' && usePV()) { // gabungkan harga dari brankas (kecuali harga yang sedang diedit dan belum tersimpan)
      const lp = LP.get(id), dirty = cur && cur.price !== undefined && cur.price !== lp;
      const pr = dirty ? cur.price : lp;
      if (pr !== undefined) next = Object.assign({}, next, { price: pr });
    }
    s.ad[k] = next; s.base.set(id, clone(server)); s.sync.set(id, J(server));
  }
  // Harga baru dari brankas: perbarui objek aset di layar, kecuali harga itu sedang diedit lokal dan belum tersimpan.
  function valueArrived(v) {
    if (!v || v.id === undefined) return;
    const a = S.assets.ad[key(v.id)], old = LP.get(v.id);
    if (a && (a.price === undefined || a.price === old)) a.price = v.price;
    LP.set(v.id, v.price);
  }
  // Sinkron setiap koleksi berubah (tidak lewat debounce) agar save() yang datang sesaat kemudian tidak memakai salinan lama.
  // Catatan baru yang belum pernah tersimpan (belum punya _c) ikut dipertahankan.
  V2.rebuild = function () {
    active().forEach(kind => {
      const s = S[kind], name = KINDS[kind].arr, keep = (AM[name] || []).filter(r => !r._c && !s.ad[key(r.id)]);
      AM[name] = Object.values(s.ad).sort(byC).concat(keep);
    });
  };
  V2.apply = function () {
    const d = AM._main; if (!d || active().some(k => !S[k].ready)) return;
    V2.rebuild(); AM.life = d.life || {};
    if (!AM.v3) {
      AM.vendors = (d.vendors && d.vendors.length) ? d.vendors : AM.vendors; AM.contacts = Array.isArray(d.contacts) ? d.contacts : (AM.contacts || []);
      AM.loans = d.loans || []; AM.market = d.market || []; AM.trades = d.trades || []; AM.incidents = d.incidents || [];
    }
    AM._msig = J(mainObj());
    const mg = migrate(); if (window.AUD) AUD.rebase();
    AM.persist();
    renderActive(); updateNotifications(); if (mg) save();
  };

  /* Pengaman: perangkat yang masih memakai layout lama (penanda ada di localStorage tiap perangkat) tidak boleh
     menulis ke settings/asset_registry bila cloud sudah memakai layout baru; kalau tidak, data "tersimpan" tetapi
     tidak pernah terbaca oleh pengguna lain. Mengembalikan true jika aman menulis cara lama. */
  V2.guardV1 = async function () {
    try {
      const { doc, getDoc } = window.fbDeps, s = await getDoc(doc(window.db, 'settings', 'asset_layout'));
      const v = s.exists() ? (s.data().v | 0) : 0;
      if (v >= 2) {
        setFlag(v >= 3 ? 3 : 2); AM.cloudErr = 'layout baru terdeteksi, aplikasi dimuat ulang. Ulangi penyimpanan setelah itu';
        setTimeout(() => location.reload(), 1800); return false;
      }
      return true;
    } catch (e) { AM.cloudErr = 'tidak bisa memeriksa layout (' + errOf(e) + ')'; return false; }
  };

  V2.watch = function () {
    if (V2._w || !window.db) return; V2._w = 1;
    const { doc, onSnapshot, collection } = window.fbDeps, db = window.db;
    onSnapshot(doc(db, 'settings', 'asset_layout'), s => {
      if (s.metadata && s.metadata.fromCache && !s.exists()) return; // belum tahu: jangan menyimpulkan "belum migrasi"
      const v = s.exists() ? (s.data().v | 0) : 0, lv = v >= 3 ? 3 : v >= 2 ? 2 : 0, pvs = (s.exists() && s.data().pv) ? 1 : 0;
      if (lv === level() && pvs === (AM.pv ? 1 : 0)) return;
      setFlag(lv); setPv(lv >= 3 && pvs);
      try { Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Penyimpanan data diperbarui. Memuat ulang...', showConfirmButton: false, timer: 1600, ...SW }); } catch (e) {}
      setTimeout(() => location.reload(), 1600);
    }, err => { console.error('Gagal membaca settings/asset_layout:', err); cloudWarn('Tidak bisa membaca penanda layout (' + errOf(err) + '). Perangkat ini bisa salah memakai layout lama. Periksa aturan Firestore untuk settings/asset_layout.'); });
    active().forEach(kind => {
      const st = S[kind];
      onSnapshot(collection(db, KINDS[kind].col), { includeMetadataChanges: true }, snap => {
        if (snap.metadata.fromCache && snap.empty && !st.ready) return; // cache kosong di perangkat baru: tunggu server
        const chs = snap.docChanges();
        if (st.ready && !chs.length) return; // hanya perubahan metadata: tidak perlu render ulang
        chs.forEach(ch => {
          const k = ch.doc.id;
          if (ch.type === 'removed') { const o = st.ad[k]; delete st.ad[k]; if (o) { st.sync.delete(o.id); st.base.delete(o.id); if (kind === 'values') LP.delete(o.id); } return; }
          if (ch.doc.metadata.hasPendingWrites && st.ad[k]) return; // gema dari tulisan kita sendiri
          ingest(kind, k, ch.doc.data());
          if (kind === 'values') valueArrived(ch.doc.data());
        });
        st.ready = true; V2.rebuild(); applyCloud();
      }, err => { AM.cloudErr = errOf(err); console.error('Koleksi ' + KINDS[kind].col + ':', err); cloudWarn('Tidak bisa membaca ' + KINDS[kind].label + ' (' + AM.cloudErr + '). Periksa aturan Firestore untuk koleksi ' + KINDS[kind].col + '.'); });
    });
  };

  /* ---------- migrasi sekali jalan (GA): v1 -> v3, atau v2 -> v3 ---------- */
  const RULES = `match /{col}/{id} {\n  allow read, write: if request.auth != null\n    && col in ['asset_items','asset_loans','asset_incidents','asset_market',\n               'asset_trades','asset_vendors','asset_contacts'];\n}\nmatch /settings/asset_layout {\n  allow read, write: if request.auth != null;\n}`;
  V2.migrate = async function () {
    if (!isGA()) return deny();
    if (AM.v3) return Swal.fire({ title: 'Sudah memakai layout terbaru', icon: 'info', ...SW });
    if (!window.db || !navigator.onLine) return Swal.fire({ title: 'Perlu koneksi', text: 'Migrasi harus dijalankan saat online.', icon: 'info', ...SW });
    if (!AM._main) return Swal.fire({ title: 'Data cloud belum termuat', text: 'Tunggu sampai data terbaru termuat, lalu coba lagi.', icon: 'info', ...SW });
    const kinds = AM.v2 ? ALL.filter(k => k !== 'assets') : ALL, total = kinds.reduce((n, k) => n + AM[KINDS[k].arr].length, 0);
    const ok = await Swal.fire({ title: 'Migrasi penyimpanan data', icon: 'warning', showCancelButton: true, confirmButtonText: 'Mulai migrasi', cancelButtonText: 'Batal', width: 560, ...SW,
      html: `<div class="text-left text-xs text-dobah-200 space-y-2"><p><b class="text-white">${total} catatan</b> (${kinds.map(k => KINDS[k].label).join(', ')}) akan dipindah ke satu-dokumen-per-catatan. Data lama tidak dihapus.</p>
        <p class="text-amber-300 font-bold">Sebelum mulai: minta semua pengguna menutup aplikasi (atau jalankan di jam sepi). Perubahan yang mereka simpan selama migrasi tidak ikut terpindah.</p>
        <p>Urutannya: unduh backup pengaman, uji izin tulis, salin, cek jumlah, baru aktifkan. Jika ada langkah gagal, tidak ada yang berubah.</p></div>` });
    if (!ok.isConfirmed) return;
    const safe = window.BKP && await BKP.safety(false, 'SEBELUM_MIGRASI_'); if (!safe) return;
    const { doc, setDoc, deleteDoc, writeBatch, getDocs, collection } = window.fbDeps, db = window.db;
    const bar = t => { const e = Swal.getTitle(); if (e) e.textContent = t; };
    Swal.fire({ title: 'Menguji izin tulis...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), ...SW });
    for (const k of kinds) {
      try { await setDoc(doc(db, KINDS[k].col, '__probe'), { t: Date.now() }); await deleteDoc(doc(db, KINDS[k].col, '__probe')); }
      catch (e) { return Swal.fire({ title: 'Koleksi belum diizinkan', icon: 'error', width: 560, ...SW, html: `<div class="text-left text-xs text-dobah-200"><p class="mb-2">Aturan Firestore belum mengizinkan koleksi <b>${KINDS[k].col}</b> (${esc(errOf(e))}). Tidak ada data yang berubah. Tambahkan aturan ini di Firebase Console, tab Rules, lalu Publish dan ulangi:</p><pre class="p-3 rounded-lg bg-[#150a05] text-[11px] whitespace-pre-wrap">${esc(RULES)}</pre></div>` }); }
    }
    try {
      for (const k of kinds) {
        const list = AM[KINDS[k].arr].slice(), col = KINDS[k].col; let mx = 0; list.forEach(r => { if (r._c > mx) mx = r._c; });
        list.forEach(r => { if (!r.id) r.id = k.slice(0, 3).toUpperCase() + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); if (!r._c) r._c = ++mx; });
        for (let i = 0; i < list.length; i += BATCH) {
          bar(`Menyalin ${KINDS[k].label} ${Math.min(i + BATCH, list.length)}/${list.length}...`);
          const b = writeBatch(db); list.slice(i, i + BATCH).forEach(r => b.set(doc(db, col, key(r.id)), JSON.parse(JSON.stringify(r)))); await b.commit();
        }
        const snap = await getDocs(collection(db, col)), ids = new Set(list.map(r => key(r.id)));
        if (snap.size < ids.size) throw new Error(`${KINDS[k].label}: ${snap.size} dokumen tersalin, seharusnya ${ids.size}`);
      }
      await setDoc(doc(db, 'settings', 'asset_layout'), { v: 3, at: Date.now(), by: (user() || {}).name || '' });
      setFlag(3);
      await Swal.fire({ title: 'Migrasi selesai', text: 'Semua pengguna akan otomatis memuat ulang. Data lama tetap tersimpan sebagai cadangan.', icon: 'success', ...SW });
      location.reload();
    } catch (e) {
      console.error(e);
      Swal.fire({ title: 'Migrasi dibatalkan', text: errOf(e) + '. Layout sebelumnya masih dipakai dan data tidak berubah. Salinan sebagian tidak berpengaruh dan akan ditimpa saat dicoba ulang.', icon: 'error', ...SW });
    }
  };

  /* ---------- Pisahkan harga ke brankas (GA, sekali jalan) ---------- */
  const PV_RULES = `match /asset_values/{id} {\n  allow read, write: if request.auth != null\n    && get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == 'General Affair Manager';\n}`;
  // Hapus kolom `price` dari semua dokumen asset_items (aman diulang).
  async function stripPrices(bar) {
    const { doc, writeBatch } = window.fbDeps, db = window.db, ids = AM.assets.map(a => a.id).filter(Boolean); let fail = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH); bar(`Menghapus harga dari data umum ${Math.min(i + BATCH, ids.length)}/${ids.length}...`);
      const mk = list => { const b = writeBatch(db); list.forEach(id => b.update(doc(db, 'asset_items', key(id)), { price: window.fbDeps.deleteField() })); return b; };
      try { await mk(chunk).commit(); }
      catch (e) { for (const id of chunk) { try { await mk([id]).commit(); } catch (e2) { fail++; } } } // dokumen yang sudah tidak ada dilewati
    }
    return fail;
  }
  V2.splitPrices = async function () {
    if (!isGA()) return deny();
    if (!AM.v3) return Swal.fire({ title: 'Upgrade layout dulu', text: 'Pisahkan harga hanya bisa setelah layout terbaru aktif.', icon: 'info', ...SW });
    if (AM.pv) return Swal.fire({ title: 'Harga sudah dipisahkan', icon: 'info', ...SW });
    if (!window.db || !navigator.onLine) return Swal.fire({ title: 'Perlu koneksi', text: 'Jalankan saat online.', icon: 'info', ...SW });
    if (!AM.assets.length || ALL.some(k => !S[k].ready)) return Swal.fire({ title: 'Data cloud belum termuat', text: 'Tunggu sampai data selesai dimuat, lalu coba lagi.', icon: 'info', ...SW });
    const withP = AM.assets.filter(a => a.id && a.price !== undefined && a.price !== null);
    const ok = await Swal.fire({ title: 'Pisahkan harga aset', icon: 'warning', showCancelButton: true, confirmButtonText: 'Mulai', cancelButtonText: 'Batal', width: 560, ...SW,
      html: `<div class="text-left text-xs text-dobah-200 space-y-2"><p>Harga <b class="text-white">${withP.length} aset</b> akan dipindah ke penyimpanan khusus GA Manager. Setelah itu staf tidak bisa membaca harga lagi.</p>
        <p class="text-amber-300 font-bold">Pastikan Anda sudah menerbitkan aturan Firestore LANGKAH A, dan minta semua pengguna menutup aplikasi selama proses ini.</p>
        <p>Urutannya: backup pengaman, uji izin, salin harga, cek jumlah, aktifkan, lalu hapus harga dari data umum. Jika ada langkah gagal sebelum "aktifkan", tidak ada yang berubah.</p></div>` });
    if (!ok.isConfirmed) return;
    const safe = window.BKP && await BKP.safety(false, 'SEBELUM_PISAH_HARGA_'); if (!safe) return;
    const { doc, setDoc, deleteDoc, writeBatch, getDocs, collection } = window.fbDeps, db = window.db;
    const bar = t => { const e = Swal.getTitle(); if (e) e.textContent = t; };
    Swal.fire({ title: 'Menguji izin tulis...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), ...SW });
    try { await setDoc(doc(db, 'asset_values', '__probe'), { t: Date.now() }); await deleteDoc(doc(db, 'asset_values', '__probe')); }
    catch (e) { return Swal.fire({ title: 'Aturan belum dipasang', icon: 'error', width: 560, ...SW, html: `<div class="text-left text-xs text-dobah-200"><p class="mb-2">Aturan Firestore belum mengizinkan koleksi <b>asset_values</b> (${esc(errOf(e))}). Tidak ada data yang berubah. Tambahkan aturan ini di Firebase Console, tab Rules, lalu Publish dan ulangi:</p><pre class="p-3 rounded-lg bg-[#150a05] text-[11px] whitespace-pre-wrap">${esc(PV_RULES)}</pre></div>` }); }
    try {
      for (let i = 0; i < withP.length; i += BATCH) {
        bar(`Menyalin harga ${Math.min(i + BATCH, withP.length)}/${withP.length}...`);
        const b = writeBatch(db); withP.slice(i, i + BATCH).forEach(a => b.set(doc(db, 'asset_values', key(a.id)), { id: a.id, price: Number(a.price) || 0, _c: 1 })); await b.commit();
      }
      bar('Memeriksa salinan...');
      const snap = await getDocs(collection(db, 'asset_values')), have = new Map(); snap.forEach(d => have.set(d.id, d.data().price));
      const bad = withP.filter(a => have.get(key(a.id)) !== (Number(a.price) || 0));
      if (bad.length) throw new Error(`${bad.length} harga tidak cocok setelah disalin`);
      await setDoc(doc(db, 'settings', 'asset_layout'), { v: 3, pv: 1, at: Date.now(), by: (user() || {}).name || '' });
      setFlag(3); setPv(1);
    } catch (e) {
      console.error(e);
      return Swal.fire({ title: 'Dibatalkan', text: errOf(e) + '. Harga belum dipindahkan dan data tidak berubah.', icon: 'error', ...SW });
    }
    let fail = 0; try { fail = await stripPrices(bar); } catch (e) { console.error(e); fail = -1; }
    await Swal.fire({ title: fail === 0 ? 'Selesai' : 'Hampir selesai', icon: fail === 0 ? 'success' : 'warning', ...SW,
      text: fail === 0 ? 'Harga kini hanya bisa dibaca GA Manager. Aplikasi akan dimuat ulang. Unduh backup baru setelah ini.' : 'Harga sudah dipindahkan, tetapi sebagian harga lama belum terhapus dari data umum. Setelah dimuat ulang, klik "Bersihkan sisa harga" di panel yang sama.' });
    location.reload();
  };
  V2.cleanPrices = async function () {
    if (!isGA()) return deny(); if (!AM.pv) return;
    const bar = t => { const e = Swal.getTitle(); if (e) e.textContent = t; };
    Swal.fire({ title: 'Membersihkan...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), ...SW });
    let fail = 0; try { fail = await stripPrices(bar); } catch (e) { console.error(e); fail = -1; }
    Swal.fire({ title: fail === 0 ? 'Bersih' : 'Belum tuntas', text: fail === 0 ? 'Tidak ada harga tersisa di data umum.' : 'Ada dokumen yang gagal dibersihkan (' + (fail < 0 ? 'kesalahan koneksi' : fail + ' dokumen') + '). Coba lagi.', icon: fail === 0 ? 'success' : 'warning', ...SW });
  };

  /* ---------- Bersihkan nominal lama di Riwayat aset & sesi opname (GA, aman diulang) ---------- */
  V2.cleanLegacy = async function () {
    if (!isGA()) return deny();
    const ok = await Swal.fire({ title: 'Bersihkan nominal lama?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Bersihkan', cancelButtonText: 'Batal', ...SW,
      text: 'Angka rupiah di Riwayat aset diganti "Rp ••••", dan harga di sesi stock opname dihapus. Nilai asli tetap ada di Audit Log (khusus GA) dan harga aset. Unduh backup dulu bila belum.' });
    if (!ok.isConfirmed) return;
    let n = 0;
    AM.assets.forEach(a => (a.history || []).forEach(h => { const t = redactRp(h.act); if (t !== h.act) { h.act = t; n++; } }));
    if (n) await save();
    if (window.OPN && OPN.clean) await OPN.clean(); else Swal.fire({ title: 'Selesai', text: n + ' catatan riwayat dibersihkan.', icon: 'success', ...SW });
  };

  V2.panel = () => `<div class="glass-panel p-5"><h3 class="text-sm font-bold text-white mb-1"><i class="fa-solid fa-gears text-dobah-400 mr-2"></i>Penyimpanan Data (Edit Bersamaan)</h3>
    ${AM.v3 ? `<p class="text-[11px] text-emerald-400 font-bold"><i class="fa-solid fa-circle-check mr-1"></i>Layout terbaru aktif: aset, peminjaman, insiden, jual-beli, vendor, dan kontak disimpan per catatan. Beberapa orang bisa mengedit bersamaan; perubahan pada kolom berbeda digabung otomatis.</p>`
      : `<p class="text-[11px] text-dobah-200/70 mb-3">${AM.v2 ? 'Aset sudah per dokumen. Upgrade untuk memecah peminjaman, insiden, jual-beli, vendor, dan kontak juga.' : 'Layout lama menyimpan semua data dalam satu dokumen, sehingga penyimpanan bersamaan bisa saling menimpa. Pindahkan ke layout baru (sekali saja, dengan backup otomatis).'}</p>
         <button onclick="V2.migrate()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2.5"><i class="fa-solid fa-arrows-rotate mr-1"></i>${AM.v2 ? 'Upgrade Layout' : 'Migrasi ke Layout Baru'}</button>`}
    ${AM.v3 ? (AM.pv ? `<p class="text-[11px] text-emerald-400 font-bold mt-4"><i class="fa-solid fa-lock mr-1"></i>Brankas harga aktif: harga aset hanya bisa dibaca GA Manager.</p><div class="flex flex-wrap gap-2 mt-2"><button onclick="V2.cleanPrices()" class="modern-button bg-cocoa-800 text-dobah-300 text-[11px] font-bold px-3 py-2 border border-white/5">Bersihkan sisa harga</button><button onclick="V2.cleanLegacy()" class="modern-button bg-cocoa-800 text-dobah-300 text-[11px] font-bold px-3 py-2 border border-white/5">Bersihkan nominal di Riwayat &amp; Opname lama</button></div>` : `<div class="mt-4 pt-4 border-t border-white/5"><p class="text-[11px] text-dobah-200/70 mb-3">Harga aset saat ini hanya disembunyikan di tampilan. Pindahkan ke brankas khusus GA Manager agar staf tidak bisa membacanya dari database (sekali saja, dengan backup otomatis).</p><button onclick="V2.splitPrices()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2.5"><i class="fa-solid fa-lock mr-1"></i>Pisahkan Harga (Rahasiakan dari Staf)</button></div>`) : ''}</div>`;
})();
