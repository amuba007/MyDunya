# Panduan Setup — Keuangan Keluarga (PWA + Google Sheets)

Total waktu sekitar 20–30 menit, sekali saja. Semua gratis.
Kamu akan membuat dua hal: **(A) API** di Google Apps Script yang menulis ke spreadsheet, dan **(B) aplikasi** (halaman web) yang di-hosting gratis di GitHub Pages.

---

## Tahap 0 — Ubah spreadsheet menjadi Google Spreadsheet asli

File di Drive-mu masih berformat `.xlsx`. Apps Script hanya bisa menulis ke Google Spreadsheet asli.

1. Buka spreadsheet Keuangan_Keluarga di Google Sheets.
2. Klik **File > Simpan sebagai Google Spreadsheet**. Tab baru terbuka; judulnya tidak lagi berakhiran `.xlsx`.
3. Pakai salinan baru ini mulai sekarang (link-nya berbeda dari yang lama).
4. Klik **File > Setelan**, pastikan **Zona waktu** = `(GMT+07:00) Jakarta`, lalu Simpan.
5. Pastikan di tab **Transaksi**, baris 1 masih berisi header: Tanggal, Jenis, Kategori, Keterangan, Jumlah (Rp), Dompet (asal), Dompet Tujuan, Dicatat oleh, Bulan. Urutan kolom boleh berbeda, tapi nama headernya jangan diubah.

## Tahap A — Pasang API (Apps Script)

1. Di spreadsheet, klik **Ekstensi > Apps Script**.
2. Hapus semua kode bawaan, lalu **tempel seluruh isi file `Code.gs`**.
3. Cari baris paling atas: `const TOKEN = '...'`. Ganti teks di dalam tanda kutip dengan **kode rahasia buatanmu** (minimal 16 karakter, campuran huruf dan angka, mis. `Kebun-Mawar-7391-Biru-Lagi`). Catat kode ini, nanti diisi di aplikasi.
4. Klik ikon disket (Simpan). Beri nama proyek, mis. "API Keuangan".
5. Di dropdown fungsi (di samping tombol Jalankan) pilih **uji**, lalu klik **Jalankan**.
   - Muncul "Perlu otorisasi" > **Tinjau izin** > pilih akun Google-mu > jika ada peringatan "Google belum memverifikasi aplikasi ini", klik **Lanjutan** > **Buka API Keuangan (tidak aman)** > **Izinkan**. Ini aman karena skrip itu buatanmu sendiri.
   - Di bagian **Log eksekusi** harus muncul tulisan seperti: `217 transaksi terbaca; 18 kategori; 6 dompet.`
6. Klik **Terapkan > Penerapan baru** (Deploy > New deployment).
   - Klik ikon roda gigi di samping "Pilih jenis" > pilih **Aplikasi web**.
   - **Jalankan sebagai**: *Saya* (akunmu).
   - **Yang memiliki akses**: *Siapa saja* (Anyone). Ini perlu agar HP bisa memanggilnya; data tetap dilindungi kode rahasia.
   - Klik **Terapkan**, lalu **salin "URL aplikasi web"** (berakhiran `/exec`).
7. Cek cepat: tempel URL itu di browser. Harus muncul teks `{"ok":true,"app":"Keuangan Keluarga API"}`.

> Jika kelak kamu mengubah isi Code.gs: **Terapkan > Kelola penerapan > ikon pensil > Versi: Versi baru > Terapkan**. URL tetap sama.

## Tahap B — Pasang aplikasi (GitHub Pages, gratis)

1. Buat akun di github.com (jika belum), lalu klik **New repository**. Nama: `keuangan` (boleh bebas). Pilih **Public**. Klik **Create repository**.
2. Di halaman repo, klik **uploading an existing file**. Dari folder `app` yang sudah diekstrak, unggah: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, dan folder `icons` (seret seluruh isinya). **Jangan unggah `Code.gs`** (tidak perlu; dan di dalamnya ada kode rahasiamu). Klik **Commit changes**.
3. Buka **Settings > Pages**. Di "Branch" pilih `main` dan folder `/ (root)`, klik **Save**.
4. Tunggu 1–2 menit. Alamat aplikasimu: `https://NAMA-GITHUB.github.io/keuangan/`

Repo boleh Public karena **tidak ada data atau kode rahasia di dalamnya**. Kode rahasia hanya kamu ketik di HP.

## Tahap C — Hubungkan di HP dan pasang di layar utama

1. Buka alamat aplikasi di HP. Isi:
   - **Alamat Web App**: URL `/exec` dari Tahap A langkah 6.
   - **Kode rahasia**: TOKEN dari Tahap A langkah 3.
   - Ketuk **Hubungkan**. Data lama langsung tampil.
2. Pasang ke layar utama:
   - **Android (Chrome)**: menu titik tiga > **Instal aplikasi** (atau **Tambahkan ke layar utama**). Bisa juga lewat tab **Akun > Pasang aplikasi**.
   - **iPhone (Safari)**: ketuk ikon **Bagikan** > **Tambahkan ke Layar Utama** > **Tambah**. (Harus lewat Safari, bukan Chrome.)
3. Buka dari ikon di layar utama. Ulangi Tahap C di HP lain (pasangan) dengan alamat dan kode yang sama.

---

## Cara kerja sehari-hari

- Ketuk tombol **+** di tengah, ketik nominal, pilih kategori, ketuk **Simpan**. Dompet dan "Dicatat oleh" otomatis memakai pilihan terakhirmu.
- Kategori, dompet, dan anggota diambil dari tab **Pengaturan** di spreadsheet. Ubah di sana, lalu tekan tombol sinkron di aplikasi.
- Tanpa internet, transaksi tersimpan di HP dan terkirim otomatis saat online.

## Keamanan

- Hanya orang yang tahu **URL /exec + kode rahasia** yang bisa membaca/menulis data. Jangan bagikan keduanya.
- Percobaan kode salah 10 kali akan mengunci API selama 10 menit.
- API hanya bisa menyentuh spreadsheet ini, dan tidak pernah menghapus baris atau sheet (hapus = mengosongkan kolom input).
- HP hilang? Ganti TOKEN di Code.gs, lalu **Terapkan > Kelola penerapan > Versi baru**. HP lama otomatis ditolak.
- Aktifkan kunci layar di HP-mu; kode rahasia tersimpan di penyimpanan aplikasi pada HP itu.

## Batasan yang perlu diketahui

- Rumus di spreadsheet mencakup baris 2–2000 tab Transaksi. Aplikasi menolak menyimpan jika sudah penuh (pesannya jelas). Mulai file baru per tahun, atau perluas rentang rumus.
- Menghapus dari aplikasi mengosongkan kolom A–H pada baris itu (rumus Bulan tetap). Baris kosong itu dipakai ulang oleh transaksi berikutnya.
- Edit/hapus memeriksa dulu bahwa baris di sheet belum berubah. Jika kamu mengurutkan sheet saat aplikasi terbuka, tekan sinkron dulu.
- Daftar kategori dibaca dari `Pengaturan!A5:D22`, dompet `F5:G10`, anggota `I5:I8`. Jika kamu menggeser tabel itu, sesuaikan fungsi `meta_()` di Code.gs.
