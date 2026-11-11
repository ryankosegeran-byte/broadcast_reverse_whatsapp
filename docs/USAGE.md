# Cara Pakai — WA Broadcast

App statis untuk menyusun pesan WhatsApp bertemplate, mengisi variabel per nomor,
lalu membuka chat WhatsApp yang sudah terisi otomatis.

Tidak ada backend. Tidak ada pengiriman otomatis.

---

## 1. Alur singkat

1. Buat template (`+ New template`).
2. Tulis pesan. Pakai `{{nama}}` untuk nama kontak dan `{{variabel}}` lain sesuai kebutuhan.
3. Isi nilai global (dipakai kalau kontak tidak punya nilai sendiri).
4. Tambah penerima: tempel baris atau tambah satu per satu.
5. Klik **Open WhatsApp** di baris penerima.
6. WhatsApp terbuka dengan teks terisi → **tekan Send sendiri**.

---

## 2. Variabel

- Sintaks: `{{nama}}`, `{{invoice}}`, `{{total}}`, `{{jatuh_tempo}}`.
- Nama variabel bebas: huruf, angka, `_`, `.`, `-`.
- Variabel terdeteksi otomatis dari body template. Hapus dari body → hilang dari form.
- `{{nama}}` **bawaan**: selalu diisi dari nama kontak, tidak perlu didefinisikan.
- Urutan nilai: nilai khusus kontak → nama kontak (untuk `{{nama}}`) → nilai global → kosong.

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

---

## 4. Badge dan status

- Kolom nilai kosong diberi garis kuning. Pesan tetap bisa dikirim, variabelnya jadi kosong.
- Tanda `✓` di kolom nomor = nomor itu sudah dibuka di WhatsApp untuk template aktif. Ini penanda lokal, **bukan** bukti pesan terkirim.
- Badge ini hilang kalau kontak dihapus atau data diimpor ulang.

---

## 5. Kirim

Klik **Open WhatsApp** → tab baru berisi:

```
https://api.whatsapp.com/send?phone=6289698129722&text=<pesan ter-encode>
```

- Teks, emoji, dan baris baru sudah terisi.
- Tombol **Send** tetap manual. Ini batasan link WhatsApp, bukan bug.
- Kalau popup diblokir, link muncul di banner atas untuk diklik manual.
- Tombol **Copy** di panel preview menyalin teks yang sudah dirender.

---

## 6. Penyimpanan

- Data disimpan di `localStorage` browser: key `wa-broadcast:v1`.
- Bahasa disimpan terpisah: key `wa-broadcast:lang`.
- Data **per browser per perangkat**. Buka di HP lain = kosong.
- Hilang kalau browsing data dibersihkan atau mode private.
- Kapasitas ~5 MB. Ratusan kontak aman.

Pindah perangkat: pakai **Export** lalu **Import**.

---

## 7. Export / Import

**Export** membuat file `wa-broadcast-backup-YYYY-MM-DD.json` berisi semua template dan kontak.
Preferensi bahasa tidak ikut.

**Import** memvalidasi file dulu, lalu menawarkan dua mode:

| Mode | Perilaku |
|---|---|
| **Merge** | Gabung. Template dicocokkan `id` lalu nama; kontak dicocokkan nomor. Data lokal menang, nilai kosong diisi dari file, `sentAt` diambil yang terbaru. Tidak ada yang dihapus. |
| **Replace all** | Hapus semua data lokal, ganti isi file. Tidak bisa dibatalkan. **Export first** dulu. |

Aturan merge:

- Template: lokal menang saat `id` atau nama sama.
- Kontak: lokal menang saat nomor sama; `name` dan nilai yang kosong diisi dari file.
- Global: hanya key yang belum ada.
- Bahasa perangkat tidak berubah.

---

## 8. Bahasa

- Default English.
- Selector di header → English / Indonesia.
- Pilihan tersimpan per perangkat dan tetap setelah refresh.
- Tambah bahasa baru: tambah objek kamus di `src/lib/i18n.svelte.js`.

---

## 9. Batasan yang perlu diketahui

- Tidak bisa kirim otomatis / tanpa klik.
- Tidak ada sinkron cloud, akun, atau statistik terkirim.
- Tidak bisa lampirkan gambar/file lewat link `text=`.
- Nomor harus nomor WhatsApp aktif. Link akan menampilkan "nomor tidak terdaftar" kalau salah.
- Teks sangat panjang bisa dipotong WhatsApp. App memberi peringatan bila URL > 8000 karakter.

---

## 10. Untuk pengembang

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
