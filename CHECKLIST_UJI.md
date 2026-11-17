# Checklist Pengujian

Centang satu per satu setelah setup selesai. Kerjakan di HP.

## A. Koneksi
- [ ] Alamat `/exec` dibuka di browser → muncul `{"ok":true,...}`.
- [ ] Isi kode rahasia yang salah di aplikasi → muncul pesan "Kode rahasia salah".
- [ ] Isi dengan benar → masuk ke Beranda; data lama tampil (jumlah transaksi di tab Akun sama dengan sheet).

## B. Input (fitur utama)
- [ ] Ketuk **+**, ketik 25000, pilih kategori, **Simpan** → toast hijau "Transaksi tersimpan".
- [ ] Buka spreadsheet → ada baris **baru** di bawah data terakhir (bukan menimpa). Tanggal = hari ini, Jenis, Kategori, Jumlah, Dompet, Dicatat oleh terisi; kolom **Bulan** terisi otomatis.
- [ ] Data lama (baris sebelumnya) **tidak berubah**.
- [ ] Waktu dari membuka aplikasi sampai tersimpan **< 10 detik**.
- [ ] Simpan tanpa nominal → pesan "Nominal wajib diisi…". Tanpa kategori → "Pilih kategori dulu".
- [ ] Nominal tidak bisa negatif (hanya angka yang diterima).
- [ ] Ganti tanggal ke kemarin → baris tersimpan dengan tanggal kemarin.
- [ ] Jenis **Pemasukan** (mis. Gaji) tersimpan dan menambah Total Pemasukan.
- [ ] Jenis **Transfer** (Bank BCA → Tunai): Dompet & Dompet Tujuan terisi, Kategori kosong. Dompet asal = tujuan ditolak.
- [ ] Keterangan diawali tanda `=` (mis. `=1+1`) tersimpan sebagai teks, bukan rumus.

## C. Dashboard
- [ ] Filter **Hari ini / Minggu ini / Bulan ini / Custom** mengubah angka.
- [ ] Total Pemasukan, Pengeluaran, Saldo bersih Bulan ini **sama** dengan tab Dashboard/Ringkasan di spreadsheet (Transfer tidak dihitung).
- [ ] Saldo dompet di Beranda sama dengan tabel "Saldo per Dompet" di tab Ringkasan.
- [ ] Insight: kategori terbesar, rata-rata harian, perbandingan periode sebelumnya tampil masuk akal.
- [ ] Tab **Statistik**: donut kategori, tren Harian/Bulanan, pemasukan vs pengeluaran, anggaran bulan ini.
- [ ] Periode tanpa data → tampilan kosong yang rapi (bukan error).

## D. Riwayat, ubah, hapus
- [ ] Riwayat menampilkan transaksi terbaru di atas, dikelompokkan per tanggal.
- [ ] Cari kata dari keterangan; filter kategori; filter rentang tanggal.
- [ ] Ketuk transaksi → ubah nominal → **Simpan perubahan** → baris yang benar di sheet berubah.
- [ ] Ketuk transaksi → ikon tempat sampah → muncul **konfirmasi** → Batal tidak menghapus; Hapus mengosongkan baris di sheet (kolom Bulan tetap berumus).

## E. Offline & PWA
- [ ] Aktifkan mode pesawat → buka aplikasi dari layar utama: data terakhir tetap tampil + banner offline.
- [ ] Mode pesawat → tambah transaksi → muncul tanda **menunggu**. Matikan mode pesawat → terkirim otomatis, tanda hilang, **tidak dobel** di sheet.
- [ ] Ikon aplikasi ada di layar utama dan terbuka layar penuh (tanpa bilah alamat).

## F. Keamanan & multi-HP
- [ ] HP kedua (pasangan): hubungkan, tambah transaksi → muncul di HP pertama setelah tekan sinkron.
- [ ] Buka URL `/exec` di browser tanpa kode: tidak ada data yang tampil.
