# admin.fucktherules.my.id

Admin gabungan FVCKTHERULES: **satu login**, menu hamburger, kategori -> sub tab.

| Kategori | Sumber | Sub tab |
|---|---|---|
| Web Utama | admin web utama (`web*.html/js/css`) | Order, Rekap Pesanan, Pengiriman, Artikel PO, Produk, Aksesoris, Tata Letak, Stok, Voucher, Galeri, Banner, Member |
| Jurnal | admin jurnal (`jurnal*`) | Overview, AI review, Articles, Discussion, Settings |
| Keuangan | aplikasi keuangan (`keuangan*`) | Dasbor, Pemasukan, Pengeluaran, Rekap Kaos, Ongkir |
| AI Office | tautan ke https://ai.fucktherules.my.id | - |

## Cara kerja
- `index.html` + `auth.js` = login sekali. Login masuk ke 4 koneksi Firebase sekaligus (toko x2, jurnal, keuangan) dengan email & password yang sama.
- Semua file ada di root (tanpa folder). Tiap panel dimuat di iframe (`web.html`, `jurnal.html`, `keuangan.html`) dan memakai sesi yang sama (satu origin). Kode isi panel tidak diubah; perubahan hanya:
  - `jurnal-firebase.js` dan `keuangan-app.js`: app Firebase diberi nama (`jurnalAdmin`, `keuanganAdmin`) supaya sesi dari shell terbaca.
  - tiap `index.html` panel: tambah `*-embed.css` (tema + sembunyikan navigasi bawaan) dan `bridge.js`.
- Panel yang dibuka langsung (mis. `/keuangan.html`) otomatis dialihkan ke shell.

## Pasang di GitHub Pages
1. Buat repo baru, upload isi folder ini, Settings -> Pages -> branch `main` / root.
2. Custom domain `admin.fucktherules.my.id` (file `CNAME` sudah ada) dan buat record DNS CNAME `admin` -> `<username>.github.io`.
3. Firebase Console -> Authentication -> Settings -> **Authorized domains**: tambah `admin.fucktherules.my.id` di 3 project (`fvcktherules-store`, `fvck-journal`, `keuangan-fvck`). Wajib untuk tombol Google.
4. Kalau API key dibatasi per referrer di Google Cloud, tambahkan `https://admin.fucktherules.my.id/*`.
