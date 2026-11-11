const KEY = 'wa-broadcast:lang'
const LANGS = ['en', 'id']

const dict = {
  en: {
    appTitle: 'WA Broadcast',
    tagline: 'Template to WhatsApp link. No backend, no auto-send.',
    help: 'Help',
    export: 'Export',
    import: 'Import',
    language: 'Language',
    templates: 'Templates',
    newTemplate: 'New template',
    noTemplates: 'No templates yet. Create one to start.',
    untitled: 'Untitled template',
    templateName: 'Template name',
    namePlaceholder: 'Payment reminder',
    messageBody: 'Message body',
    bodyPlaceholder: 'Type your message here. Use *{{nama}}* and other {{variables}}.',
    variables: 'Variables',
    insertHint: 'Type {{variable}} in the message body to create one, or add it below. Click a chip to insert it at the cursor.',
    nameBuiltinHint: '{{nama}} is filled from the contact name.',
    varNamePlaceholder: 'invoice',
    addVariable: 'Add variable',
    badVarName: 'Variable name can only use letters, numbers, and _ . -',
    globalValues: 'Global values',
    globalHint: 'Used when a contact has no value for this template.',
    preview: 'Preview',
    copy: 'Copy',
    copied: 'Copied',
    selectTemplate: 'Create or select a template.',
    recipients: 'Recipients',
    addContact: 'Add contact',
    pasteRows: 'Paste rows',
    pastePlaceholder: '628111|Budi|INV-001|55161\n628222|Siti|INV-002|42000',
    pasteHelp: 'One row per contact: phone | name | values in variable order. Separators: | tab ,',
    pasteResult: 'Added {ok}. Skipped {fail}.',
    add: 'Add',
    cancel: 'Cancel',
    phone: 'Phone',
    name: 'Name',
    search: 'Search',
    action: 'Action',
    openWa: 'Open WhatsApp',
    delete: 'Delete',
    confirmDeleteContact: 'Delete this contact?',
    confirmDeleteTemplate: 'Delete this template and its per-contact values?',
    noContacts: 'No recipients yet. Add one or paste rows.',
    empty: 'empty',
    opened: 'Opened',
    emptyValueWarn: 'Some values are empty. The message still opens with blanks.',
    badPhone: 'Phone number is not valid. Use 08... or 62...',
    dupPhone: 'That phone number is already in the list.',
    exportFirst: 'Export first',
    importTitle: 'Import backup',
    importFound: 'File has {t} template(s) and {c} contact(s).',
    importReplace: 'Replace all',
    importMerge: 'Merge',
    importReplaceWarn: 'Replace deletes all local data first. This cannot be undone.',
    importDone: 'Import complete.',
    importBadFile: 'Could not read that file.',
    importNotJson: 'That file is not a valid backup.',
    importNewer: 'This backup comes from a newer app version.',
    importPhone: 'That backup has invalid phone numbers.',
    warnNewer: 'Stored data comes from a newer app version and was not loaded.',
    warnCorrupt: 'Stored data was corrupt. A copy was kept and the app started empty.',
    warnStorage: 'This browser blocks local storage. Nothing will be saved.',
    storageFull: 'Storage is full. Export a backup, then delete old contacts.',
    popupBlocked: 'Popup blocked. Open this link manually:',
    urlTooLong: 'Message is very long. WhatsApp may cut it.',
    close: 'Close',
    helpTitle: 'How to use',
    helpItems: [
      'Create a template, write the message, and use {{nama}} for the contact name plus any other {{variable}} you need. Create a variable by typing {{like_this}} in the body or using Add variable.',
      'Fill global values for text that is the same for everyone.',
      'Add contacts by pasting rows (phone | name | values in variable order) or one at a time.',
      'Click Open WhatsApp on a row. WhatsApp opens with the text prefilled. You still press Send yourself.',
      'Data is stored in this browser only. Export a backup before switching devices or clearing browser data.',
      'Import a backup and pick Replace all or Merge.',
      'Language is saved per device.',
    ],
    devicesNote: 'Saved in this browser only',
    rows: '{n} contacts',
    addRow: 'Add row',
  },
  id: {
    appTitle: 'WA Broadcast',
    tagline: 'Template jadi link WhatsApp. Tanpa backend, tanpa kirim otomatis.',
    help: 'Bantuan',
    export: 'Ekspor',
    import: 'Impor',
    language: 'Bahasa',
    templates: 'Template',
    newTemplate: 'Template baru',
    noTemplates: 'Belum ada template. Buat satu untuk mulai.',
    untitled: 'Template tanpa nama',
    templateName: 'Nama template',
    namePlaceholder: 'Pengingat pembayaran',
    messageBody: 'Isi pesan',
    bodyPlaceholder: 'Ketik pesan di sini. Pakai *{{nama}}* dan {{variabel}} lain.',
    variables: 'Variabel',
    insertHint: 'Tulis {{variabel}} di badan pesan untuk membuatnya, atau tambah lewat kotak di bawah. Klik chip untuk menyisipkan di posisi kursor.',
    nameBuiltinHint: '{{nama}} diisi dari nama kontak.',
    varNamePlaceholder: 'invoice',
    addVariable: 'Tambah variabel',
    badVarName: 'Nama variabel hanya boleh huruf, angka, dan _ . -',
    globalValues: 'Nilai global',
    globalHint: 'Dipakai saat kontak tidak punya nilai untuk template ini.',
    preview: 'Pratinjau',
    copy: 'Salin',
    copied: 'Tersalin',
    selectTemplate: 'Buat atau pilih template.',
    recipients: 'Penerima',
    addContact: 'Tambah kontak',
    pasteRows: 'Tempel baris',
    pastePlaceholder: '628111|Budi|INV-001|55161\n628222|Siti|INV-002|42000',
    pasteHelp: 'Satu baris per kontak: nomor | nama | nilai sesuai urutan variabel. Pemisah: | tab ,',
    pasteResult: 'Ditambah {ok}. Dilewati {fail}.',
    add: 'Tambah',
    cancel: 'Batal',
    phone: 'Nomor',
    name: 'Nama',
    search: 'Cari',
    action: 'Aksi',
    openWa: 'Buka WhatsApp',
    delete: 'Hapus',
    confirmDeleteContact: 'Hapus kontak ini?',
    confirmDeleteTemplate: 'Hapus template ini beserta nilai per kontaknya?',
    noContacts: 'Belum ada penerima. Tambah satu atau tempel baris.',
    empty: 'kosong',
    opened: 'Dibuka',
    emptyValueWarn: 'Ada nilai kosong. Pesan tetap dibuka dengan bagian kosong.',
    badPhone: 'Nomor tidak valid. Pakai 08... atau 62...',
    dupPhone: 'Nomor itu sudah ada di daftar.',
    exportFirst: 'Ekspor dulu',
    importTitle: 'Impor cadangan',
    importFound: 'File berisi {t} template dan {c} kontak.',
    importReplace: 'Ganti semua',
    importMerge: 'Gabung',
    importReplaceWarn: 'Ganti semua menghapus data lokal lebih dulu. Tidak bisa dibatalkan.',
    importDone: 'Impor selesai.',
    importBadFile: 'File tidak bisa dibaca.',
    importNotJson: 'File itu bukan cadangan yang valid.',
    importNewer: 'Cadangan ini dari versi app yang lebih baru.',
    importPhone: 'Cadangan berisi nomor yang tidak valid.',
    warnNewer: 'Data tersimpan berasal dari versi app lebih baru dan tidak dimuat.',
    warnCorrupt: 'Data tersimpan rusak. Salinan disimpan dan app mulai kosong.',
    warnStorage: 'Browser ini memblokir local storage. Tidak ada yang akan tersimpan.',
    storageFull: 'Penyimpanan penuh. Ekspor cadangan, lalu hapus kontak lama.',
    popupBlocked: 'Popup diblokir. Buka link ini manual:',
    urlTooLong: 'Pesan terlalu panjang. WhatsApp bisa memotongnya.',
    close: 'Tutup',
    helpTitle: 'Cara pakai',
    helpItems: [
      'Buat template, tulis pesan, pakai {{nama}} untuk nama kontak dan {{variabel}} lain yang dibutuhkan. Buat variabel dengan menulis {{seperti_ini}} di body atau lewat Tambah variabel.',
      'Isi nilai global untuk teks yang sama bagi semua orang.',
      'Tambah kontak dengan menempel baris (nomor | nama | nilai sesuai urutan variabel) atau satu per satu.',
      'Klik Buka WhatsApp di satu baris. WhatsApp terbuka dengan teks terisi. Tombol Send tetap Anda yang tekan.',
      'Data hanya tersimpan di browser ini. Ekspor cadangan sebelum ganti perangkat atau hapus data browser.',
      'Impor cadangan lalu pilih Ganti semua atau Gabung.',
      'Pilihan bahasa disimpan per perangkat.',
    ],
    devicesNote: 'Tersimpan hanya di browser ini',
    rows: '{n} kontak',
    addRow: 'Tambah baris',
  },
}

function readLang() {
  try {
    const saved = localStorage.getItem(KEY)
    if (LANGS.includes(saved)) return saved
  } catch {
    /* storage blocked */
  }
  return 'en'
}

let current = $state(readLang())

export function lang() {
  return current
}

export function setLang(next) {
  if (!LANGS.includes(next)) return
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* storage blocked */
  }
  applyLang()
}

export function applyLang() {
  document.documentElement.lang = current
  document.title = t('appTitle')
}

export function t(key, params) {
  const text = dict[current][key] ?? dict.en[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '')
}
