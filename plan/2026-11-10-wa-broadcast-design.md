# WA Broadcast — Desain & Struktur Kerja

Tanggal: 2026-11-10
Status: menunggu review
Pendekatan UI: **A. Workspace 1 layar**

---

## 1. Ringkasan

Webapp statis untuk menyusun pesan WhatsApp bertemplate, mengisi variabel per nomor,
lalu membuka chat WhatsApp yang sudah terisi otomatis lewat link.

Inti kerja app cuma satu:

```
template body + nilai variabel  →  encodeURIComponent  →  https://api.whatsapp.com/send?phone=...&text=...
```

User klik satu nomor → tab WhatsApp terbuka dengan teks siap kirim → user tekan Send sendiri.

---

## 2. Batasan yang disepakati

| Hal | Keputusan |
|---|---|
| Backend | **Tidak ada.** Cloudflare Pages statis murni |
| Auto-send | **Tidak bisa.** WhatsApp link hanya prefill; user tetap tekan Send |
| Kirim massal 1 klik | **Tidak.** 1 klik = 1 nomor (manual satu per satu) |
| Penyimpanan | `localStorage` browser user, bukan cookie, bukan server |
| Sinkron antar perangkat | **Tidak otomatis.** Via Export/Import JSON |
| Akun/login | Tidak ada |
| Statistik terpusat | Tidak ada. Status "sudah dikirim" hanya lokal |
| API WhatsApp resmi | Tidak dipakai. Tidak ada token, tidak ada biaya |
| Target jumlah kontak | 500 per perangkat |

Konsekuensi `localStorage`:

- Data terikat **origin** (`https://xxx.pages.dev` atau domain custom).
- Ganti domain = data lama tidak terbaca → **pasang domain custom sebelum dipakai user**.
- Hilang bila user clear browsing data atau pakai mode private.
- Kapasitas ~5 MB. 500 kontak ≈ 150 KB, aman.

---

## 3. Stack & struktur file

Svelte 5 + Vite. Build `dist/` diupload ke Cloudflare Pages. Tanpa function, tanpa env var.

```
index.html
vite.config.js
package.json
docs/
  USAGE.md              panduan pemakaian (markdown, arsip repo)
src/
  main.js
  App.svelte
  lib/
    storage.js          load / save / migrate / export / import / merge
    vars.js             detectVariables() / resolve() / render()
    wa.js               normalizePhone() / buildWaUrl()
    i18n.js             kamus en/id + t() reaktif + bahasa tersimpan
    Preview.svelte
    RecipientTable.svelte
    ImportDialog.svelte
    HelpModal.svelte    panduan singkat di dalam app
  styles.css
```

Pembagian tanggung jawab:

- `wa.js` — murni fungsi: normalisasi nomor + bangun URL. Tidak menyentuh state.
- `vars.js` — murni fungsi: deteksi `{{...}}`, resolusi nilai, render body.
- `storage.js` — baca/tulis `localStorage`, validasi file import, gabung/replace.
- `i18n.js` — kamus bahasa, pilihan bahasa, persistensi bahasa.
- `App.svelte` — pemilik state, orkestrasi.
- Komponen presentasional: preview, tabel penerima, dialog import, help modal.

---

## 4. Model data

**Dua key terpisah:**

| Key | Isi |
|---|---|
| `wa-broadcast:v1` | seluruh data (template + kontak) |
| `wa-broadcast:lang` | preferensi bahasa perangkat: `"en"` atau `"id"` |

Bahasa sengaja dipisah: import mode "ganti semua" tidak boleh menimpa bahasa perangkat,
dan export tidak membawa preferensi bahasa orang lain.

```js
{
  schemaVersion: 1,
  updatedAt: "2026-11-10T12:18:00.000Z",
  templates: [
    {
      id: "tpl_ab12",
      name: "Payment Reminder",
      body: "⏰ *Payment Reminder*\n\nHello *{{nama}}*,\n\nYour internet bill is due:\n\n📋 Invoice No.: {{invoice}}\n💰 Total: *Rp {{total}}*\n📅 Due Date: *{{jatuh_tempo}}*\n...",
      globals: { invoice: "", total: "", jatuh_tempo: "" },
      createdAt: "2026-11-10T12:00:00.000Z",
      updatedAt: "2026-11-10T12:00:00.000Z"
    }
  ],
  contacts: [
    {
      id: "c_xy34",
      phone: "6289698129722",
      name: "FENDY STEVANUS RUUS",
      values: {
        "tpl_ab12": { "invoice": "INV-202611-00489", "total": "55.161", "jatuh_tempo": "10 November 2026" }
      },
      sentAt: { "tpl_ab12": "2026-11-10T12:18:00.000Z" }
    }
  ]
}
```

Aturan:

- `contacts[].phone` — nomor ternormalisasi, unik.
- `contacts[].name` — nama pemilik nomor. Satu field saja. Jadi identitas baris di tabel **dan** variabel bawaan `{{nama}}`.
- `templates[].globals` — nilai default satu template, dipakai kalau kontak tidak punya nilai.
- `contacts[].values[templateId][key]` — nilai khusus kontak untuk template itu. Tidak menyimpan `nama`; itu diambil dari `contact.name`.
- `contacts[].sentAt[templateId]` — penanda lokal "sudah dibuka", **bukan** bukti terkirim.
- Kontak **global**, dipakai lintas template. Nilai variabel disimpan per template.
- Hapus kontak → semua `values` dan `sentAt` ikut hilang.
- Hapus template → `values[templateId]` di semua kontak dibersihkan.

---

## 5. Alur kerja pengguna

Satu layar, tiga area:

```
┌──────────────┬─────────────────────────────┬───────────────┐
│ Templates    │ Template editor             │ Preview       │
│              │  - name                     │  live render  │
│ [+ New]      │  - body (textarea)          │  + [Copy]     │
│ [Export]     │  - variable chips           │               │
│ [Import]     │  - global values            │               │
│ [? Help]     │                             │               │
├──────────────┴─────────────────────────────┴───────────────┤
│ Recipients: [paste rows] [+ add] [search]                   │
│ ┌────────┬──────────────┬────────┬─────────┬──────┬───────┐   │
│ │ Phone  │ Name         │ invoice│ total   │ ...  │ Action│   │
│ │ 62...  │ FENDY ...    │ INV-.. │ 55.161  │      │ [WA]🗑 │   │
│ └────────┴──────────────┴────────┴─────────┴──────┴───────┘   │
└─────────────────────────────────────────────────────────────┘
```

Langkah nyata:

1. Pilih template di sidebar (atau buat baru). Awal buka: **kosong**, tidak ada template contoh; tampil placeholder + tombol buka Help.
2. Edit body. Tulis `{{nama}}`, `{{invoice}}`, dst. App otomatis mendeteksi variabel.
3. Isi nilai global (opsional) — untuk pesan yang sama ke semua nomor.
4. Tambah kontak:
   - **Paste rows**: `628xxx|FENDY STEVANUS RUUS|INV-001|55161|10 November 2026`
   - Pemisah menerima `|`, tab, atau `,`.
   - Kolom ke-1 nomor, ke-2 nama, sisanya mengisi variabel sesuai urutan kemunculan di body.
   - Baris hanya nomor tetap sah → nama kosong, nilai pakai global.
   - **Add manual**: form nomor + nama + isian variabel.
5. Tabel menampilkan hasil render per baris. Nama bisa diedit inline. Nilai kosong ditandai badge peringatan, tidak memblokir kirim.
6. Klik **[WA]** pada baris → buka `api.whatsapp.com/send?...` di tab baru → `sentAt` baris ditandai.
7. Ulangi untuk nomor berikutnya. Tombol **[Copy]** di preview untuk kirim manual bila perlu.

Kolom tabel: Nomor, Name, lalu variabel terdeteksi (urutan kemunculan di body).

Performa: 500 baris dirender biasa. Baris memakai `content-visibility: auto` supaya browser
melewati render baris di luar layar. Virtual scroll tidak dipakai — tambah kalau tembus ~2000 baris.

---

## 6. Logika inti

### 6.1 Deteksi variabel

```js
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
detectVariables(body) // → ["nama", "invoice", ...] unik, urut kemunculan
```

Tidak ada registry variabel terpisah. Variabel yang dihapus dari body otomatis hilang dari form.
Nilai lama tetap tersimpan di data (tidak dibuang) supaya tidak hilang saat body diedit.

`nama` adalah variabel bawaan yang selalu tersedia tanpa perlu didefinisikan:
selalu diresolusi dari `contact.name`. Template boleh memakainya atau tidak.

### 6.2 Resolusi nilai

Urutan, berhenti di yang pertama ada:

1. `contact.values[template.id][key]`
2. kalau `key === "nama"` → `contact.name`
3. `template.globals[key]`
4. `""`

```js
export function resolve(key, contact, template) {
  return contact?.values?.[template.id]?.[key]
    ?? (key === "nama" ? contact?.name : undefined)
    ?? template.globals[key]
    ?? "";
}
render(body, contact, template) {
  return body.replace(VAR_RE, (_, key) => resolve(key, contact, template));
}
```

### 6.3 Normalisasi nomor

- Buang semua non-digit.
- `08xxxxxxxxx` → `628xxxxxxxxx`
- `628...` → tetap
- `+62...` → `62...`
- Validasi: 8–15 digit, harus mulai `62` setelah normalisasi.
- Duplikat nomor ditolak saat tambah/paste.

### 6.4 URL WhatsApp

```js
buildWaUrl(phone, text) {
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}
```

`encodeURIComponent` membiarkan `*`, `'`, `(`, `)`, `!`, `~` apa adanya — diterima WhatsApp, aman.
Baris baru jadi `%0A`, emoji jadi percent-encoding UTF-8.

Contoh hasil (dipakai sebagai test manual):

```
https://api.whatsapp.com/send?phone=6289698129722&text=%E2%8F%B0%20*Pengingat%20Pembayaran*...
```

---

## 7. Persistensi

- Load saat mount: baca `wa-broadcast:v1` → kalau kosong, mulai state kosong (tanpa template contoh).
- Kalau `schemaVersion` lebih kecil → jalankan migrasi; kalau lebih besar → peringatan "data dari versi lebih baru", jangan timpa.
- Simpan: debounce 200 ms, tulis seluruh state (`JSON.stringify`), `try/catch` untuk quota exceeded.
- Quota exceeded → toast error + saran Export lalu hapus kontak lama.
- Data korup → salin ke `wa-broadcast:v1:corrupt`, mulai kosong, tawarkan Import.
- Bahasa: baca `wa-broadcast:lang`; kalau kosong → `"en"`.

---

## 8. Export / Import

### Export

- Tombol `Export` → `Blob` JSON → `URL.createObjectURL` → `<a download>`.
- Nama file: `wa-broadcast-backup-YYYY-MM-DD.json`.
- Isi: `wa-broadcast:v1` saja (`schemaVersion`, `templates`, `contacts`). Preferensi bahasa tidak ikut.

### Import

1. `<input type="file" accept=".json,application/json">` → `FileReader`.
2. Validasi: ukuran < 5 MB, JSON valid, `schemaVersion` dikenal, `templates` & `contacts` array, tiap kontak punya nomor valid.
3. Gagal validasi → pesan spesifik, data lokal tidak disentuh.
4. Lolos → dialog pilih mode:

**Replace all**
- Konfirmasi eksplisit, sebut jumlah template & kontak yang akan diganti.
- Tawarkan tombol "Export first".
- Setelah konfirmasi: timpa state, tulis storage, reload UI. Bahasa tidak berubah.

**Merge**
- Template: cocokkan `id`; kalau tidak ada, cocokkan `name`. Yang sudah ada **tidak ditimpa**. Template baru ditambahkan.
- Kontak: cocokkan nomor ternormalisasi. Kontak lokal menang; field/nilai yang kosong di lokal diisi dari file. `sentAt` diambil yang paling baru.
- Globals: hanya mengisi key yang belum ada.
- Tidak ada data yang dihapus.

---

## 9. Internasionalisasi

- Default **English**. Bisa pindah ke **Indonesia** lewat selector di header.
- Kamus di `src/lib/i18n.js`:

```js
export const dict = {
  en: { appTitle: "WA Broadcast", send: "Open WhatsApp", ... },
  id: { appTitle: "WA Broadcast", send: "Buka WhatsApp", ... }
};
```

- `t(key)` reaktif; ganti bahasa langsung re-render tanpa reload.
- Simpan pilihan ke `wa-broadcast:lang`.
- Saat bahasa berubah: set `document.title` dan `<html lang="en|id">`.
- Tambah bahasa baru = tambah satu objek kamus + satu opsi di selector. Tidak ada perubahan lain.

---

## 10. Dokumentasi

Dua tampilan, satu isi:

1. **`docs/USAGE.md`** — panduan lengkap di repo.
2. **Help modal di app** (`?` di header, juga tampil saat state masih kosong) — versi ringkas, karena user Cloudflare Pages tidak melihat repo.

Isi wajib:

- Cara membuat template dan sintaks `{{variabel}}` (termasuk `{{nama}}` bawaan).
- Cara menambah kontak (manual + paste baris), format kolom.
- Normalisasi nomor (`08...` → `62...`).
- Arti badge nilai kosong.
- Bahwa kirim tetap manual: klik WA → tekan Send di WhatsApp.
- Export/Import: kapan pakai, beda replace vs merge.
- Data tersimpan per perangkat/browser; pindah perangkat pakai Export/Import.
- Ganti bahasa.

Aturan: setiap perubahan fitur wajib memperbarui **keduanya** dalam commit yang sama.

---

## 11. Deploy & update

### Pertama kali

1. `npm install` → `npm run build` → `dist/`.
2. Cloudflare Pages → Create project → upload `dist/`.
   Alternatif CLI: `npx wrangler pages deploy dist`.
3. Pasang domain custom sekarang, sebelum user mulai memakai.

### Update

- Via GitHub integration: push → build otomatis → live.
- Data user aman selama **key `wa-broadcast:v1` tidak diubah** dan `schemaVersion` dimigrasikan.

Aturan rilis:

- Tambah field baru → `schemaVersion` boleh tetap, atau naikkan + tulis migrasi.
- Rename/ubah bentuk data → wajib naikkan `schemaVersion` + fungsi migrasi.
- Jangan hapus key lama sebelum migrasi terbukti jalan.

---

## 12. Edge case & error handling

| Kasus | Perilaku |
|---|---|
| Body kosong | Tombol WA disabled untuk template itu |
| Variabel belum diisi | Baris tetap bisa dikirim, ada badge "empty value"; preview menandai bagian kosong |
| Nama kontak kosong | Boleh; `{{nama}}` jadi string kosong |
| Nomor tidak valid | Baris ditolak saat input, pesan error jelas |
| Nomor duplikat | Ditolak, baris yang sudah ada disorot |
| Paste format salah | Baris gagal dilaporkan satu per satu, baris valid tetap masuk |
| `localStorage` penuh | Toast error + saran Export |
| Data korup di storage | Backup ke `:corrupt`, mulai kosong, tawarkan Import |
| Import versi lebih baru | Ditolak dengan pesan |
| Popup blocker | `window.open` dari klik langsung; kalau diblokir tampilkan fallback link untuk diklik manual |
| Template dihapus | Konfirmasi, lalu bersihkan `values` terkait |
| Teks sangat panjang | Peringatan bila hasil URL > ~8000 karakter (batas praktis WhatsApp) |
| 500 kontak | Normal; `content-visibility: auto` pada baris |

---

## 13. Verifikasi

Tanpa framework test. Satu file test kecil (`node --test`) untuk fungsi murni:

1. `normalizePhone("089698129722") === "6289698129722"`
2. `normalizePhone("+62 896-9812-9722") === "6289698129722"`
3. `detectVariables("Halo {{nama}}, total {{total}}")` → `["nama","total"]`
4. `resolve()` urutan: nilai kontak → `contact.name` untuk `nama` → globals → `""`
5. `buildWaUrl()` menghasilkan URL persis seperti contoh 6.4

Uji manual:

- Refresh halaman → template, kontak, dan bahasa tetap.
- Export → clear storage → Import → data kembali sama, bahasa tidak berubah.
- Import merge ke data yang sudah ada → tidak ada yang terhapus.
- Klik WA → tab WhatsApp benar, teks sesuai preview.
- Ganti bahasa → semua label berubah, bertahan setelah refresh.

---

## 14. Di luar cakupan (sengaja tidak dibuat)

- Auto-send / bulk tanpa klik.
- Sinkron cloud, akun, multi-user.
- CSV upload (cukup paste baris; tambahkan kalau benar-benar perlu).
- Penjadwalan kirim.
- Lampiran gambar/file (link WhatsApp `text=` tidak mendukung media).
- Riwayat pengiriman terpusat.
- Virtual scroll (belum perlu untuk 500 baris).
- Template contoh bawaan.

---

## 15. Keputusan terkunci

| # | Keputusan |
|---|---|
| 1 | Mulai kosong, tanpa template contoh; panduan di Help modal + `docs/USAGE.md` |
| 2 | Satu field `name` per kontak; jadi identitas baris **dan** variabel bawaan `{{nama}}` |
| 3 | Target 500 kontak; tanpa virtual scroll; pakai `content-visibility: auto` |
| 4 | UI default English, bisa switch ke Indonesia; pilihan disimpan di `wa-broadcast:lang` |
| 5 | Import menawarkan dua mode saat dijalankan: Replace all / Merge |
| 6 | Export/Import satu file JSON; bahasa tidak ikut |
| 7 | Tanpa backend, tanpa build-time env, deploy statis ke Cloudflare Pages |
