# Membuat ulang css/tailwind.css

css/tailwind.css berisi HANYA class Tailwind yang dipakai. Jika kamu menambah class Tailwind
BARU di index.html atau file js (mis. `bg-teal-500`), class itu belum ada di CSS sampai dibuild ulang.
(Class yang sudah dipakai sebelumnya tidak terpengaruh.)

Cara build (butuh Node.js), dari folder utama proyek:

    npm install tailwindcss@3.4.17
    npx tailwindcss -c tools/tailwind.config.js -i tools/input.css -o css/tailwind.css --minify

Lalu upload css/tailwind.css yang baru. Atau kirim perubahanmu ke Claude untuk dibuildkan.
Warna yang dibuat dinamis oleh kode (mis. bg-${c}-500/10) terdaftar di `safelist` pada tools/tailwind.config.js;
tambahkan nama warna baru di sana bila perlu.

# Ikon FontAwesome ringan

css/fontawesome-subset.css + assets/fonts/fa-*-subset.woff2 hanya berisi ikon yang tertulis di index.html / js.
Jika kamu menambah ikon baru (mis. `fa-solid fa-truck`), ikon itu belum ada di font ringan dan tampil KOSONG
sampai file-file tersebut dibuat ulang dari paket resmi @fortawesome/fontawesome-free@6.4.0.
Kirim perubahanmu ke Claude untuk dibuildkan, atau sementara pakai ikon yang sudah ada.
