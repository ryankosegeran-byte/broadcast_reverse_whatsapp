# Cara Pakai — WA Broadcast

App statis untuk menyusun pesan WhatsApp bertemplate, mengisi variabel per nomor,
lalu membuka chat WhatsApp yang sudah terisi otomatis.

Tidak ada backend. Tidak ada pengiriman otomatis.

---

## 1. Alur singkat

1. Buat template (**New template**), atau langsung isi daftar **Penerima** kapan saja (kontak tetap bisa ditambah, diimpor, dilabeli, dan dikelola walau belum ada template).
2. Tulis pesan. Pakai bilah format untuk `*tebal*`, `_miring_`, `~coret~`, `` `kode` ``, serta tombol menu emoji (`😊`) untuk menyisipkan emoji, dan pakai `{{nama}}` untuk nama kontak serta `{{variabel}}` lain sesuai kebutuhan.
3. Atur variabel template (nama tampilan dan nilai bawaan / global) di panel **Variabel** yang terpisah tepat di bawah daftar kontak pada kolom kiri (atau tepat di bawah editor pesan pada tab **Susun** di HP).
4. Di tampilan desktop, panel **Penerima** berada di bawah daftar **Template** (kolom kiri) dengan kotak pencarian yang selalu tampil dan tombol **+ Tambah**, **Tempel**, serta **CSV/VCF** yang membuka dialog mengambang terpisah di luar box daftar kontak.
5. Saring penerima lewat chip label atau pencarian, dan centang kontak tertentu jika hanya ingin mengirim ke subset kontak.
6. Klik kontak di daftar untuk mempratinjau pesannya di panel kanan, klik **Atur** (atau klik ganda baris kontak) untuk membuka modal per nomor berisi tiga bagian terpisah (**Info kontak**, **Label**, **Variabel template**) beserta pratinjau langsung dan tombol **Sebelumnya / Berikutnya**, lalu klik **WA** / **Open WhatsApp**.
7. Di HP (layar `<= 760px`), app memakai viewport terkunci (`100dvh`) dengan 4 tab di bar bawah (**Template**, **Susun**, **Pratinjau**, **Kirim**) dan menu utilitas (**Bahasa**, **Tema**, **Ekspor**, **Impor**, **Impor CSV / VCF**, **Bantuan**, **Tentang**) di tombol **Menu** kanan atas. Di mode **Kirim**, tersedia tampilan **Daftar** (kartu penuh tanpa scroll menyamping) dan **Fokus** (kirim satu per satu dengan pratinjau langsung), serta tombol **Atur** untuk membuka modal per nomor.
8. WhatsApp terbuka dengan teks terisi → **tekan Send sendiri**.
9. Penghapusan template atau kontak dikonfirmasi langsung di tempat (tekan `Escape` atau **Cancel** untuk membatalkan).

---

## 2. Variabel

- Sintaks: `{{nama}}`, `{{invoice}}`, `{{total}}`, `{{jatuh_tempo}}`.
- Nama variabel bebas: huruf, angka, `_`, `.`, `-`.
- Variabel dibuat dengan **menulis `{{nama_var}}` di badan pesan**, atau lewat kotak **Add variable** di bagian Variables (isi nama, klik Add → mendaftarkan variabel ke template dan menyisipkan token di posisi kursor).
- Variabel di template = gabungan variabel yang terdaftar di `vars[]` dan token `{{...}}` yang ada di body template.
- **Manajer variabel per template**: setiap variabel tampil dalam satu baris berisi:
  - **Key** (read-only, sesuai token `{{key}}`).
  - **Display name** (nama tampilan opsional — dipakai di modal kelola per nomor, kartu mobile, dan daftar pemetaan impor CSV/VCF).
  - **Default** (tersimpan sebagai `globals[key]` — dipakai bila kontak tidak punya nilai khusus untuk template aktif).
  - **Remove variable** (tombol hapus — menghapus definisi dari template dan sekaligus menghapus semua token `{{key}}` dari body pesan).
- `{{nama}}` **bawaan**: selalu diisi dari nama kontak, tidak masuk ke manajer variabel.
- Urutan nilai: nilai khusus kontak → nama kontak (untuk `{{nama}}`) → nilai otomatis → nilai bawaan/global → kosong.

Contoh body:

```
⏰ *Pengingat Pembayaran*

Halo *{{nama}}*,

Tagihan internet Anda akan jatuh tempo:

📋 No. Invoice: {{invoice}}
💰 Total: *Rp {{total}}*
📅 Jatuh Tempo: *{{jatuh_tempo}}*

Segera lakukan pembayaran untuk menghindari pemutusan layanan.

di link pembayaran berikut:
https://payment.myryzz.net/

Terima kasih 🙏
_MyRyzzNet_
```

---

## Nilai otomatis dari tanggal

Tiap variabel punya nilai bawaan manual. Untuk variabel tanggal (mis. `bulan_ini`, `tahun_ini`)
sebaiknya pakai **Otomatis**:

1. Buka panel **Variabel**, buka template yang dipakai.
2. Klik **Otomatis** di baris variabel.
3. Pilih format di modal: tanggal + nama bulan + tahun, nama bulan saja, tahun, nomor bulan,
   nomor bulan/tahun, nama hari, atau tanggal angka.
4. Nilainya langsung dipakai di pratinjau, tabel kontak, dan placeholder form tambah kontak.

Nilai diambil dari tanggal perangkat saat pesan ditampilkan, jadi ikut berubah sendiri tiap hari.
Bahasa nama bulan dan nama hari mengikuti bahasa aplikasi (Indonesia/Inggris). Tombol **Hapus**
mengembalikan variabel ke nilai bawaan manual. Nilai per kontak tetap menang kalau diisi manual.

---

## 3. Menambah penerima

### Tambah manual

Isi nomor, nama, lalu nilai variabel. Nomor otomatis dinormalisasi:

| Ditulis | Disimpan |
|---|---|
| `0896-9812-9722` | `6289698129722` |
| `+62 896 9812 9722` | `6289698129722` |
| `6289698129722` | `6289698129722` |

Nomor duplikat ditolak. Nomor tidak valid ditolak.

### Tempel baris

Format: `nomor | nama | nilai1 | nilai2 | ...`

- Pemisah boleh `|`, tab, atau `,`.
- Kolom ke-1 nomor, ke-2 nama, sisanya mengisi variabel **sesuai urutan kemunculan di body** (kecuali `{{nama}}`).
- Baris hanya berisi nomor tetap sah → nilai diambil dari global.

Contoh:

```
6289698129722|FENDY STEVANUS RUUS|INV-202611-00489|55.161|10 November 2026
6281234567890|SITI|INV-202611-00490|42.000|10 November 2026
```

### Import CSV / VCF

Klik **Import CSV / VCF** di header panel penerima (atau di tombol **Menu** pada tampilan HP):

- Pilih atau seret file `.csv` (pemisah `,`, `;`, atau tab dengan dukungan tanda kutip RFC 4180) maupun `.vcf` (ekspor kontak dari HP; mendukung `TEL`, `FN`/`N`, serta baris terlipat).
- Header kolom ditebak otomatis (`phone`/`nomor`/`hp`/`wa` → Nomor, `name`/`nama`/`fn` → Nama, `label`/`tag`/`grup`/`kategori` → Label, serta nama/key variabel template aktif).
- Sesuaikan pemetaan tiap kolom (**Phone**, **Name**, **Label**, variabel template, atau **Ignore**) sambil melihat pratinjau 10 baris pertama. Kolom **Phone** wajib dipetakan agar tombol **Import** aktif.
- **Banyak label dalam satu sel**: pisahkan dengan `;` atau `|` (contoh: `VIP;Jatuh Tempo` atau `VIP|Lunas`). Koma tidak dipakai sebagai pemisah label agar tidak bentrok dengan pemisah CSV.
- **Aturan dedup & gabung**: kontak dicocokkan lewat nomor ternormalisasi. Bila nomor sudah ada, nama dan nilai variabel lokal tetap dipertahankan (hanya bagian yang kosong diisi dari file), label digabung (union tanpa duplikat), dan `sentAt` mengambil waktu terbaru. Nomor baru ditambahkan, sedangkan baris bernomor tidak valid dilewati dengan ringkasan hasil (`Ditambah`, `Digabung`, `Dilewati`).

---

## 4. Label, filter, dan seleksi

- **Multi-label per kontak**: setiap kontak dapat memiliki lebih dari satu label bebas (contoh: `VIP`, `Jatuh Tempo`). Tambah atau hapus chip label di modal per nomor (**Atur** → bagian **Label**) dengan saran label yang sudah ada, atau langsung di kartu kontak mobile. Warna chip dihitung otomatis dari nama label.
- **Filter label (OR)**: bila ada minimal satu label pada kontak, bar filter label muncul di atas daftar penerima. Mengklik satu atau lebih chip label menampilkan kontak yang memiliki **salah satu** label yang dipilih (semantik OR). Klik **Clear** atau nonaktifkan chip untuk menampilkan semua kontak kembali. Filter label dapat digabung dengan kotak pencarian nama/nomor.
- **Seleksi & working set**: setiap baris daftar dan kartu mobile memiliki kotak centang, disertai **Select all** / **Clear selection** yang berlaku pada daftar yang sedang tampil (setelah filter + pencarian). Bila ada satu atau lebih kontak yang dicentang, ringkasan penerima serta navigasi modal / mode **Fokus** bekerja pada subset yang dicentang (pilihan bersifat sementara di sesi UI dan tidak ikut disimpan).

### Modal kelola per nomor

Klik **Atur** (atau klik ganda baris kontak) untuk membuka modal per nomor yang terbagi menjadi 3 bagian:

1. **Info kontak**: ubah nomor (divalidasi & dinormalisasi otomatis saat simpan) dan nama kontak.
2. **Label**: tambah atau hapus chip label kontak, atau klik chip label yang sudah ada untuk menambahkannya dalam satu klik.
3. **Variabel template**: isi atau ubah nilai khusus untuk template aktif (tersimpan di `values[templateId]`). Kolom tanpa nilai khusus menampilkan nilai bawaan template bila ada, dan tombol **Pakai bawaan** mengembalikan nilai ke default template.

Di sisi kanan modal tampil **Pratinjau** pesan WhatsApp secara langsung, tombol navigasi **Sebelumnya / Berikutnya** untuk berpindah antar nomor tanpa menutup modal, serta tombol **Buka WhatsApp**.

---

## 5. Badge dan status

- Badge `{n} kosong` pada baris kontak (atau garis batas kuning/amber pada input di modal / kartu mobile) menandakan ada variabel yang masih kosong. Pesan tetap bisa dikirim, variabelnya jadi kosong.
- Badge **Opened** (atau **Dibuka** di mode Indonesia) pada kontak = nomor itu sudah dibuka di WhatsApp untuk template aktif. Ini penanda lokal, **bukan** bukti pesan terkirim.
- Badge ini hilang kalau kontak dihapus atau data diimpor dengan mode **Replace all**.

---

## 6. Kirim

Klik **Open WhatsApp** → tab baru berisi:

```
https://api.whatsapp.com/send?phone=6289698129722&text=<pesan ter-encode>
```

- Teks, emoji, dan baris baru sudah terisi.
- Tombol **Send** tetap manual. Ini batasan link WhatsApp, bukan bug.
- Kalau popup diblokir, link muncul di banner atas untuk diklik manual.
- Tombol **Copy** di panel preview menyalin teks yang sudah dirender.

---

## 7. Penyimpanan

- Data disimpan di `localStorage` browser: key `wa-broadcast:v1`.
- Bahasa (`wa-broadcast:lang`), tema tampilan (`wa-broadcast:theme`), dan riwayat emoji terakhir (`wa-broadcast:recent-emojis`) disimpan terpisah per perangkat.
- Data **per browser per perangkat**. Buka di HP lain = kosong.
- Hilang kalau browsing data dibersihkan atau mode private.
- Kapasitas ~5 MB. Ratusan kontak aman.

Pindah perangkat: pakai **Export** lalu **Import**.

---

## 8. Export / Import

**Export** membuat file `wa-broadcast-backup-YYYY-MM-DD.json` berformat `schemaVersion: 3` yang berisi semua template (termasuk definisi variabel `vars`, preset otomatis `auto`, dan nilai bawaan `globals`) serta semua kontak (termasuk `labels`, `values`, dan `sentAt`).
Preferensi bahasa dan tema tidak ikut.

**Import** memvalidasi file dulu (menampilkan jumlah template, kontak, dan label yang ditemukan), lalu menawarkan dua mode. File cadangan `schemaVersion: 1` dan `schemaVersion: 2` lama tetap bisa diimpor dan otomatis diupgrade dengan `vars: []`, `auto: {}`, dan `labels: []`:

| Mode | Perilaku |
|---|---|
| **Merge** | Gabung. Template dicocokkan `id` lalu nama; kontak dicocokkan nomor. Data lokal menang, nilai kosong diisi dari file, `sentAt` diambil yang terbaru. Tidak ada yang dihapus. |
| **Replace all** | Hapus semua data lokal, ganti isi file. Tidak bisa dibatalkan. **Export first** dulu. |

Aturan merge:

- Template: lokal menang saat `id` atau nama sama; `vars` digabung per key (mengisi nama tampilan yang masih kosong dan menambah key baru).
- Kontak: lokal menang saat nomor sama; `name` dan nilai yang kosong diisi dari file, `labels` digabung (union tanpa duplikat).
- Global: hanya key yang belum ada.
- Bahasa dan tema perangkat tidak berubah.

---

## 9. Bahasa dan tema

- Default English dan tema terang (light).
- Switch **EN | ID** di header → English / Indonesia.
- Tombol ikon matahari/bulan di header → ganti tema terang / gelap.
- Pilihan tersimpan per perangkat dan tetap setelah refresh.
- Tambah bahasa baru: tambah objek kamus di `src/lib/i18n.svelte.js`.

---

## 10. Tentang

Tombol **Tentang** di header (dan item **Tentang** di menu mobile) membuka modal berisi:

- Nama app, versi (dari `package.json`), dan tahun.
- Ringkasan fitur.
- Teknologi: Svelte + Vite, tanpa backend, data hanya di browser.
- Catatan bahwa app ini bukan produk resmi WhatsApp.
- Pembuat: nama, link repositori GitHub, dan email.

Tombol **Tutup**, `Escape`, atau klik di luar modal menutupnya.

---

## 11. Batasan yang perlu diketahui

- Tidak bisa kirim otomatis / tanpa klik.
- Tidak ada sinkron cloud, akun, atau statistik terkirim.
- Tidak bisa lampirkan gambar/file lewat link `text=`.
- Nomor harus nomor WhatsApp aktif. Link akan menampilkan "nomor tidak terdaftar" kalau salah.
- Teks sangat panjang bisa dipotong WhatsApp. App memberi peringatan bila URL > 8000 karakter.
- Impor CSV / VCF mewajibkan satu kolom nomor yang dipetakan; baris tanpa nomor valid akan dilewati.
- Label bersifat teks bebas per kontak (tidak ada daftar grup/registry terpisah; mengubah nama label dilakukan di masing-masing kontak).

---

## 12. Untuk pengembang

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # unit test fungsi murni
npm run build    # hasil di dist/
```

Deploy: Cloudflare Pages, build command `npm run build`, output directory `dist`.

Detail keputusan desain: `plan/2026-11-10-wa-broadcast-design.md`.

Aturan: setiap perubahan fitur wajib memperbarui file ini **dan** isi Help modal di app
(`helpItems` pada `src/lib/i18n.svelte.js`).
