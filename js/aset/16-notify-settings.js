/* Modul Aset: pengaturan notifikasi DI LUAR aplikasi (Push, WhatsApp, Email).

   Sisi web (file ini) hanya menyimpan pilihan & kontak tiap pengguna di settings/notif_<uid>:
     { name, role, branches, push:{on,tokens:[...]}, wa:{on,phone}, email:{on,address}, updatedAt }
   Pengiriman sebenarnya dilakukan oleh Cloud Functions (folder functions/), karena browser tidak bisa
   mengirim WhatsApp/email atau push saat aplikasi tertutup. */
(() => {
  const SW = { background: '#22120a', color: '#fcf6f0', confirmButtonColor: '#f4a23a' };
  const NTF = window.NTF = { prefs: null };
  const uid = () => (user() || {}).id;
  const docId = () => 'notif_' + uid();
  const V = '10.8.0';

  async function load() {
    if (NTF.prefs) return NTF.prefs;
    let p = null;
    try { p = JSON.parse(localStorage.getItem('ga_ntf_' + uid()) || 'null'); } catch (e) {}
    if (window.db) { try { const { getDoc, doc } = window.fbDeps; const s = await getDoc(doc(window.db, 'settings', docId())); if (s.exists()) p = s.data(); } catch (e) {} }
    return (NTF.prefs = p || { push: { on: false, tokens: [] }, wa: { on: false, phone: '' }, email: { on: false, address: '' } });
  }
  async function persist(p) {
    const u = user() || {};
    p.name = u.name || ''; p.role = u.role || ''; p.branches = u.branches || []; p.updatedAt = Date.now(); NTF.prefs = p;
    try { localStorage.setItem('ga_ntf_' + uid(), JSON.stringify(p)); } catch (e) {}
    if (!window.db) return false;
    const { setDoc, doc } = window.fbDeps; await setDoc(doc(window.db, 'settings', docId()), p); return true;
  }

  // Normalisasi nomor WA Indonesia -> 628xxxxxxxx
  const normPhone = s => { let n = String(s || '').replace(/[^\d+]/g, '').replace(/^\+/, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n; };

  async function pushToken() {
    const key = (window.GA_NOTIFY || {}).vapidKey;
    if (!key) throw new Error('Kunci VAPID belum diisi di js/notify-config.js');
    if (!('serviceWorker' in navigator) || !('Notification' in window)) throw new Error('Browser ini tidak mendukung notifikasi push');
    if (!window.fbApp) throw new Error('Firebase belum siap');
    const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('Izin notifikasi ditolak di browser');
    const reg = (window.PWA && PWA.reg) || await navigator.serviceWorker.ready;
    const m = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-messaging.js`);
    if (!(await m.isSupported())) throw new Error('Push tidak didukung di browser ini (di iPhone, pasang dulu ke Layar Utama)');
    return m.getToken(m.getMessaging(window.fbApp), { vapidKey: key, serviceWorkerRegistration: reg });
  }

  NTF.open = async function () {
    if (!user()) return;
    const p = await load(), inp = 'w-full px-3 py-2 text-sm rounded-lg bg-[#150a05] border border-white/10 text-white', cfg = !!(window.GA_NOTIFY || {}).vapidKey;
    const row = (id, on, title, desc, field) => `<div class="p-3 rounded-xl bg-[#150a05] border border-white/5 text-left"><label class="flex gap-2 items-start font-bold text-[#edd5b3] text-xs"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} class="mt-0.5"><span>${title}<br><span class="font-normal text-dobah-200/60">${desc}</span></span></label>${field || ''}</div>`;
    const r = await Swal.fire({ title: 'Notifikasi di Luar Aplikasi', width: 520, ...SW, showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
      html: `<div class="space-y-3 text-xs">
        ${row('ntP', p.push && p.push.on, 'Push ke HP / browser', cfg ? 'Muncul seperti notifikasi aplikasi, walau web tertutup. Di iPhone, pasang dulu ke Layar Utama.' : 'Belum dikonfigurasi admin (kunci VAPID kosong).')}
        ${row('ntW', p.wa && p.wa.on, 'WhatsApp', 'Ringkasan dan peringatan penting dikirim ke nomor WhatsApp Anda.', `<input id="ntWp" class="${inp} mt-2" placeholder="08xxxxxxxxxx" value="${esc((p.wa || {}).phone || '')}" inputmode="tel">`)}
        ${row('ntE', p.email && p.email.on, 'Email', 'Ringkasan harian dan peringatan penting ke email Anda.', `<input id="ntEa" type="email" class="${inp} mt-2" placeholder="nama@perusahaan.com" value="${esc((p.email || {}).address || '')}">`)}
        <p class="text-dobah-200/50 text-left">Isi yang dikirim: pengajuan baru / berubah status, peminjaman jatuh tempo, kontrak vendor dan garansi hampir habis, aset rusak. Nomor &amp; email hanya dipakai untuk pengiriman ini.</p></div>`,
      preConfirm: () => {
        const o = { push: $('ntP').checked, wa: $('ntW').checked, phone: normPhone($('ntWp').value), email: $('ntE').checked, address: $('ntEa').value.trim() };
        if (o.wa && !/^62\d{8,13}$/.test(o.phone)) { Swal.showValidationMessage('Nomor WhatsApp tidak valid (contoh 081234567890)'); return false; }
        if (o.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.address)) { Swal.showValidationMessage('Alamat email tidak valid'); return false; }
        return o;
      } });
    if (!r.isConfirmed) return;
    const o = r.value, np = { push: { on: false, tokens: (p.push || {}).tokens || [] }, wa: { on: o.wa, phone: o.phone }, email: { on: o.email, address: o.address } };
    let note = '';
    if (o.push) {
      try { const t = await pushToken(); if (t && !np.push.tokens.includes(t)) np.push.tokens = [...np.push.tokens, t].slice(-5); np.push.on = !!t; }
      catch (e) { note = 'Push belum aktif: ' + (e.message || e); np.push.on = false; }
    }
    try { await persist(np); Swal.fire({ title: note ? 'Tersimpan sebagian' : 'Tersimpan', text: note || 'Pengaturan notifikasi disimpan.', icon: note ? 'warning' : 'success', ...SW }); }
    catch (e) { Swal.fire({ title: 'Gagal menyimpan', text: e.code || e.message || '', icon: 'error', ...SW }); }
  };

  // Tombol di panel notifikasi (menyambung ke ncFoot buatan 11-notifications.js; dipanggil dari ui())
  NTF.footer = () => '<button onclick="NTF.open()" class="text-[11px] font-bold text-dobah-300 underline"><i class="fa-solid fa-phone-volume mr-1"></i>Notifikasi WA / Email / Push</button>';
})();
