# WA Broadcast

Static webapp: susun template pesan WhatsApp, isi variabel per nomor, lalu buka chat
WhatsApp yang sudah terisi lewat link. Tanpa backend, tanpa auto-send.

- Panduan pemakaian: [`docs/USAGE.md`](docs/USAGE.md)
- Desain & keputusan: [`plan/2026-11-10-wa-broadcast-design.md`](plan/2026-11-10-wa-broadcast-design.md)

## Development

```bash
npm install
npm run dev
npm run test
npm run build
```

## Deploy

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Tanpa environment variable, tanpa function

Atau manual: `npx wrangler pages deploy dist`

## Simpanan data

`localStorage` pada browser user:

- `wa-broadcast:v1` — template + kontak
- `wa-broadcast:lang` — bahasa

Jangan ubah nama key tanpa migrasi. Naikkan `schemaVersion` bila bentuk data berubah.
