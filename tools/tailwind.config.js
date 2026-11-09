/** Konfigurasi build Tailwind (hanya dipakai saat membuat ulang css/tailwind.css) */
const warnaDinamis = ['amber','blue','emerald','orange','rose','slate','violet','sky','red','green','dobah'];
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  // class yang dibuat kode secara dinamis, mis. `bg-${c}-500/10`, tidak bisa dideteksi otomatis
  safelist: warnaDinamis.flatMap(c => [
    `text-${c}-400`, `bg-${c}-500/10`, `border-${c}-500/20`, `bg-${c}-400/20`, `border-${c}-400/30`
  ]),
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        dobah: {
          50: '#fcf6f0', 100: '#f7ebd9', 200: '#edd5b3', 300: '#e1b782', 400: '#f4a23a',
          500: '#d97d26', 600: '#a75d22', 700: '#84471b', 800: '#5c3113', 900: '#3a1f0c', 950: '#211006',
        },
        cocoa: { 800: '#331d14', 900: '#22120a', 950: '#150a05' },
      },
    },
  },
};
