export const RECENT_EMOJIS_KEY = 'wa-broadcast:recent-emojis'
export const DEFAULT_RECENT_EMOJIS = ['👋', '🙏', '⏰', '📋', '💰', '📅', '✅', '✨']
const MAX_RECENT = 16

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    icon: 'smile',
    emojis: [
      { char: '😀', name: 'Grinning face', kw: 'smile happy senang senyum tertawa' },
      { char: '😃', name: 'Grinning face with big eyes', kw: 'smile happy gembira senang' },
      { char: '😄', name: 'Grinning face with smiling eyes', kw: 'happy laugh senang tawa' },
      { char: '😁', name: 'Beaming face', kw: 'grin smile cengir senang' },
      { char: '😅', name: 'Grinning sweat', kw: 'nervous relief keringat gugup' },
      { char: '😂', name: 'Face with tears of joy', kw: 'laugh funny ngakak ketawa lucu' },
      { char: '🤣', name: 'Rolling on the floor laughing', kw: 'laugh rofl ngakak' },
      { char: '😊', name: 'Smiling face with smiling eyes', kw: 'warm blush ramah senyum manis' },
      { char: '😇', name: 'Smiling face with halo', kw: 'angel good baik suci' },
      { char: '🙂', name: 'Slightly smiling face', kw: 'smile polite ramah senyum' },
      { char: '😉', name: 'Winking face', kw: 'wink kedip' },
      { char: '😌', name: 'Relieved face', kw: 'calm relief lega tenang' },
      { char: '😍', name: 'Heart eyes', kw: 'love adore cinta suka' },
      { char: '🥰', name: 'Smiling face with hearts', kw: 'love warm sayang cinta' },
      { char: '😘', name: 'Blowing a kiss', kw: 'kiss love cium sayang' },
      { char: '😋', name: 'Savoring food', kw: 'yum delicious enak lezat' },
      { char: '😎', name: 'Smiling face with sunglasses', kw: 'cool keren santai' },
      { char: '🤩', name: 'Star-struck', kw: 'wow excited kagum keren' },
      { char: '🥳', name: 'Partying face', kw: 'party celebrate selamat pesta ulang tahun' },
      { char: '😏', name: 'Smirking face', kw: 'smirk senyum miring' },
      { char: '😔', name: 'Pensive face', kw: 'sad sorry maaf sedih' },
      { char: '🥺', name: 'Pleading face', kw: 'please puppy eyes mohon' },
      { char: '😢', name: 'Crying face', kw: 'sad tear sedih nangis' },
      { char: '😭', name: 'Loudly crying face', kw: 'sob sad sedih nangis' },
      { char: '😤', name: 'Face with steam from nose', kw: 'frustrated hmph kesal' },
      { char: '😠', name: 'Angry face', kw: 'mad angry marah' },
      { char: '🤯', name: 'Exploding head', kw: 'mind blown shocked kaget' },
      { char: '😳', name: 'Flushed face', kw: 'embarrassed shy malu kaget' },
      { char: '😱', name: 'Face screaming in fear', kw: 'omg shocked panik kaget' },
      { char: '🤗', name: 'Hugging face', kw: 'hug welcome peluk ramah' },
      { char: '🤔', name: 'Thinking face', kw: 'hmm think mikir tanya' },
      { char: '🤭', name: 'Face with hand over mouth', kw: 'oops giggle ups' },
      { char: '🤫', name: 'Shushing face', kw: 'quiet secret diam rahasia' },
      { char: '😶', name: 'Face without mouth', kw: 'silent diam' },
      { char: '😐', name: 'Neutral face', kw: 'meh datar biasa' },
      { char: '🙄', name: 'Face with rolling eyes', kw: 'eyeroll malas' },
      { char: '😴', name: 'Sleeping face', kw: 'sleep tired tidur ngantuk' },
      { char: '😷', name: 'Face with medical mask', kw: 'sick mask sakit masker' },
      { char: '🤒', name: 'Face with thermometer', kw: 'fever sick demam sakit' },
      { char: '👋', name: 'Waving hand', kw: 'hello hi salam halo hai' },
      { char: '🤚', name: 'Raised back of hand', kw: 'stop hand tangan' },
      { char: '✋', name: 'Raised hand', kw: 'stop high five tangan' },
      { char: '👌', name: 'OK hand', kw: 'ok good oke sip mantap' },
      { char: '🤌', name: 'Pinched fingers', kw: 'chef kiss gesture' },
      { char: '✌️', name: 'Victory hand', kw: 'peace two damai' },
      { char: '🤞', name: 'Crossed fingers', kw: 'luck hope harap semoga' },
      { char: '🫶', name: 'Heart hands', kw: 'love thanks terima kasih cinta' },
      { char: '👉', name: 'Backhand index pointing right', kw: 'point right lihat klik lanjut' },
      { char: '👇', name: 'Backhand index pointing down', kw: 'point down bawah link' },
      { char: '👆', name: 'Backhand index pointing up', kw: 'point up atas' },
      { char: '👍', name: 'Thumbs up', kw: 'like ok yes setuju sip bagus mantap' },
      { char: '👎', name: 'Thumbs down', kw: 'dislike no tidak' },
      { char: '👏', name: 'Clapping hands', kw: 'clap bravo tepuk tangan hebat' },
      { char: '🙌', name: 'Raising hands', kw: 'hooray celebrate syukur mantap' },
      { char: '🤝', name: 'Handshake', kw: 'deal agree kerja sama sepakat salam' },
      { char: '🙏', name: 'Folded hands', kw: 'please thanks mohon maaf terima kasih makasih salam' },
      { char: '💪', name: 'Flexed biceps', kw: 'strong semangat kuat' },
    ],
  },
  {
    id: 'nature',
    icon: 'leaf',
    emojis: [
      { char: '🐶', name: 'Dog face', kw: 'dog puppy anjing' },
      { char: '🐱', name: 'Cat face', kw: 'cat kitty kucing' },
      { char: '🐰', name: 'Rabbit face', kw: 'bunny kelinci' },
      { char: '🐻', name: 'Bear', kw: 'bear beruang' },
      { char: '🐼', name: 'Panda', kw: 'panda' },
      { char: '🦊', name: 'Fox', kw: 'fox rubah' },
      { char: '🦁', name: 'Lion', kw: 'lion singa' },
      { char: '🐮', name: 'Cow face', kw: 'cow sapi' },
      { char: '🐸', name: 'Frog', kw: 'frog kodok katak' },
      { char: '🐵', name: 'Monkey face', kw: 'monkey monyet' },
      { char: '🐔', name: 'Chicken', kw: 'chicken ayam' },
      { char: '🐧', name: 'Penguin', kw: 'penguin pinguin' },
      { char: '🦋', name: 'Butterfly', kw: 'butterfly kupu kupu' },
      { char: '🐝', name: 'Honeybee', kw: 'bee lebah madu' },
      { char: '🐢', name: 'Turtle', kw: 'turtle kura kura' },
      { char: '🐳', name: 'Spouting whale', kw: 'whale paus' },
      { char: '🐬', name: 'Dolphin', kw: 'dolphin lumba' },
      { char: '🌱', name: 'Seedling', kw: 'plant grow tunas tumbuh' },
      { char: '🌿', name: 'Herb', kw: 'leaf green daun hijau' },
      { char: '🍀', name: 'Four leaf clover', kw: 'luck daun semanggi untung' },
      { char: '🌸', name: 'Cherry blossom', kw: 'flower pink bunga sakura' },
      { char: '🌺', name: 'Hibiscus', kw: 'flower bunga' },
      { char: '🌻', name: 'Sunflower', kw: 'sunflower bunga matahari' },
      { char: '🌹', name: 'Rose', kw: 'rose flower mawar bunga' },
      { char: '☀️', name: 'Sun', kw: 'sun morning pagi cerah matahari' },
      { char: '🌤️', name: 'Sun behind small cloud', kw: 'weather siang cerah berawan' },
      { char: '🌙', name: 'Crescent moon', kw: 'moon night malam bulan ramadan' },
      { char: '🌈', name: 'Rainbow', kw: 'rainbow pelangi' },
    ],
  },
  {
    id: 'food',
    icon: 'coffee',
    emojis: [
      { char: '🍎', name: 'Red apple', kw: 'apple fruit apel buah' },
      { char: '🍊', name: 'Tangerine', kw: 'orange jeruk buah' },
      { char: '🍋', name: 'Lemon', kw: 'lemon jeruk' },
      { char: '🍉', name: 'Watermelon', kw: 'watermelon semangka' },
      { char: '🍓', name: 'Strawberry', kw: 'strawberry stroberi' },
      { char: '🥭', name: 'Mango', kw: 'mango mangga' },
      { char: '🥑', name: 'Avocado', kw: 'avocado alpukat' },
      { char: '🍞', name: 'Bread', kw: 'bread roti' },
      { char: '🥐', name: 'Croissant', kw: 'pastry roti sarapan' },
      { char: '🍔', name: 'Hamburger', kw: 'burger makan' },
      { char: '🍟', name: 'French fries', kw: 'fries kentang' },
      { char: '🍕', name: 'Pizza', kw: 'pizza makan' },
      { char: '🍜', name: 'Steaming bowl', kw: 'noodle ramen bakmi mie' },
      { char: '🍛', name: 'Curry rice', kw: 'rice curry nasi kari' },
      { char: '🍣', name: 'Sushi', kw: 'sushi jepang' },
      { char: '🍱', name: 'Bento box', kw: 'lunch box makan siang' },
      { char: '🍚', name: 'Cooked rice', kw: 'rice nasi' },
      { char: '🍩', name: 'Doughnut', kw: 'donut donat manis' },
      { char: '🍪', name: 'Cookie', kw: 'cookie kue biskuit' },
      { char: '🎂', name: 'Birthday cake', kw: 'cake birthday kue ulang tahun' },
      { char: '🍰', name: 'Shortcake', kw: 'cake kue dessert' },
      { char: '🍫', name: 'Chocolate bar', kw: 'chocolate coklat' },
      { char: '☕', name: 'Hot beverage', kw: 'coffee tea kopi teh santai pagi' },
      { char: '🍵', name: 'Teacup', kw: 'tea match teh hangat' },
      { char: '🧋', name: 'Bubble tea', kw: 'boba tea minuman' },
      { char: '🥤', name: 'Cup with straw', kw: 'drink soda jus minuman' },
      { char: '🥂', name: 'Clinking glasses', kw: 'cheers celebrate selamat' },
      { char: '🍽️', name: 'Fork and knife with plate', kw: 'meal dinner makan' },
    ],
  },
  {
    id: 'travel',
    icon: 'compass',
    emojis: [
      { char: '⚽', name: 'Soccer ball', kw: 'football bola olahraga' },
      { char: '🏀', name: 'Basketball', kw: 'basket olahraga' },
      { char: '🎮', name: 'Video game', kw: 'game main' },
      { char: '🎯', name: 'Direct hit', kw: 'target goal tepat sasaran' },
      { char: '🏆', name: 'Trophy', kw: 'win winner piala juara' },
      { char: '🎁', name: 'Wrapped gift', kw: 'gift present hadiah kado promo bonus' },
      { char: '🎉', name: 'Party popper', kw: 'celebrate congrats selamat sukses' },
      { char: '🎊', name: 'Confetti ball', kw: 'party selamat perayaan' },
      { char: '🚗', name: 'Automobile', kw: 'car mobil antar' },
      { char: '🛵', name: 'Motor scooter', kw: 'ojek kurir motor delivery kirim' },
      { char: '🚚', name: 'Delivery truck', kw: 'truck shipping kirim paket ekspedisi' },
      { char: '✈️', name: 'Airplane', kw: 'flight travel pesawat terbang' },
      { char: '🚀', name: 'Rocket', kw: 'launch fast roket cepat' },
      { char: '🚂', name: 'Locomotive', kw: 'train kereta' },
      { char: '🏠', name: 'House', kw: 'home house rumah alamat' },
      { char: '🏢', name: 'Office building', kw: 'office kantor gedung' },
      { char: '🏪', name: 'Convenience store', kw: 'shop store toko outlet' },
      { char: '🏥', name: 'Hospital', kw: 'hospital klinik rumah sakit' },
      { char: '🏦', name: 'Bank', kw: 'bank transfer rekening' },
      { char: '📍', name: 'Round pushpin', kw: 'location map lokasi alamat tempat' },
      { char: '🗺️', name: 'World map', kw: 'map peta lokasi' },
      { char: '🏖️', name: 'Beach with umbrella', kw: 'holiday vacation libur pantai' },
      { char: '⛰️', name: 'Mountain', kw: 'mountain gunung' },
      { char: '🚦', name: 'Traffic light', kw: 'traffic lampu jalan' },
    ],
  },
  {
    id: 'objects',
    icon: 'lightbulb',
    emojis: [
      { char: '⏰', name: 'Alarm clock', kw: 'alarm reminder time waktu jam jatuh tempo' },
      { char: '⏱️', name: 'Stopwatch', kw: 'timer fast cepat waktu' },
      { char: '🕰️', name: 'Mantelpiece clock', kw: 'clock jam waktu' },
      { char: '⏳', name: 'Hourglass', kw: 'wait pending tunggu batas waktu' },
      { char: '📅', name: 'Calendar', kw: 'date schedule tanggal jadwal jatuh tempo' },
      { char: '📆', name: 'Tear-off calendar', kw: 'date jadwal hari' },
      { char: '📋', name: 'Clipboard', kw: 'list detail catatan invoice nota daftar' },
      { char: '🧾', name: 'Receipt', kw: 'invoice bill struk tagihan kwitansi nota' },
      { char: '💰', name: 'Money bag', kw: 'money total price uang rupiah bayar tagihan' },
      { char: '💵', name: 'Dollar banknote', kw: 'cash money tunai uang bayar' },
      { char: '💳', name: 'Credit card', kw: 'card payment bayar transfer rekening' },
      { char: '💎', name: 'Gem stone', kw: 'vip premium berlian' },
      { char: '🛒', name: 'Shopping cart', kw: 'shop order cart keranjang belanja pesanan' },
      { char: '🛍️', name: 'Shopping bags', kw: 'shop order belanja promo' },
      { char: '📦', name: 'Package', kw: 'parcel box order paket kirim barang' },
      { char: '🏷️', name: 'Label', kw: 'price tag diskon promo harga label' },
      { char: '📱', name: 'Mobile phone', kw: 'phone whatsapp hp nomor kontak' },
      { char: '💻', name: 'Laptop', kw: 'computer internet kerja laptop' },
      { char: '🔗', name: 'Link', kw: 'url link tautan bayar' },
      { char: '🔔', name: 'Bell', kw: 'alert notify reminder pengingat notifikasi' },
      { char: '📢', name: 'Loudspeaker', kw: 'announce broadcast info pengumuman' },
      { char: '📣', name: 'Megaphone', kw: 'promo info broadcast pengumuman' },
      { char: '✉️', name: 'Envelope', kw: 'mail message pesan surat' },
      { char: '📩', name: 'Envelope with arrow', kw: 'inbox send pesan masuk' },
      { char: '📝', name: 'Memo', kw: 'note write catatan tulis' },
      { char: '📄', name: 'Page facing up', kw: 'document file dokumen berkas' },
      { char: '📊', name: 'Bar chart', kw: 'report stats laporan data' },
      { char: '📌', name: 'Pushpin', kw: 'pin important penting catatan' },
      { char: '🔒', name: 'Locked', kw: 'secure private aman kunci' },
      { char: '🔑', name: 'Key', kw: 'key access kunci kode' },
      { char: '💡', name: 'Light bulb', kw: 'idea tip info ide tips' },
      { char: '🛠️', name: 'Hammer and wrench', kw: 'maintenance service perbaikan gangguan' },
    ],
  },
  {
    id: 'symbols',
    icon: 'heart',
    emojis: [
      { char: '✅', name: 'Check mark button', kw: 'done ok verified selesai lunas benar centang' },
      { char: '☑️', name: 'Check box with check', kw: 'check ok selesai centang' },
      { char: '✔️', name: 'Check mark', kw: 'check yes centang' },
      { char: '❌', name: 'Cross mark', kw: 'no cancel wrong batal gagal silang' },
      { char: '⚠️', name: 'Warning', kw: 'alert warning perhatian hati hati' },
      { char: '❗', name: 'Red exclamation mark', kw: 'important urgent penting segera' },
      { char: '❓', name: 'Red question mark', kw: 'question tanya bantuan' },
      { char: '🚫', name: 'Prohibited', kw: 'stop banned dilarang tutup' },
      { char: '✨', name: 'Sparkles', kw: 'new promo shine baru spesial kilau' },
      { char: '🔥', name: 'Fire', kw: 'hot promo trending laris' },
      { char: '💯', name: 'Hundred points', kw: '100 full mantap sempurna' },
      { char: '⭐', name: 'Star', kw: 'star favorite rating bintang' },
      { char: '🌟', name: 'Glowing star', kw: 'star special bintang' },
      { char: '⚡', name: 'High voltage', kw: 'fast instant kilat cepat listrik' },
      { char: '💥', name: 'Collision', kw: 'boom promo ledak' },
      { char: '❤️', name: 'Red heart', kw: 'love heart cinta kasih sayang' },
      { char: '💚', name: 'Green heart', kw: 'green whatsapp heart hijau suka' },
      { char: '💙', name: 'Blue heart', kw: 'blue heart biru' },
      { char: '🧡', name: 'Orange heart', kw: 'orange heart oranye' },
      { char: '💜', name: 'Purple heart', kw: 'purple heart ungu' },
      { char: '🤍', name: 'White heart', kw: 'white heart putih' },
      { char: '➡️', name: 'Right arrow', kw: 'next arrow lanjut ke' },
      { char: '⬅️', name: 'Left arrow', kw: 'back arrow kembali' },
      { char: '🔴', name: 'Red circle', kw: 'red dot merah tutup mati' },
      { char: '🟡', name: 'Yellow circle', kw: 'yellow dot kuning proses' },
      { char: '🟢', name: 'Green circle', kw: 'green dot aktif online hijau buka' },
      { char: '🔵', name: 'Blue circle', kw: 'blue dot biru info' },
      { char: '💬', name: 'Speech balloon', kw: 'chat message pesan balas' },
    ],
  },
  {
    id: 'flags',
    icon: 'flag',
    emojis: [
      { char: '🇮🇩', name: 'Indonesia', kw: 'indonesia id merah putih' },
      { char: '🇲🇾', name: 'Malaysia', kw: 'malaysia my' },
      { char: '🇸🇬', name: 'Singapore', kw: 'singapore singapura sg' },
      { char: '🇹🇭', name: 'Thailand', kw: 'thailand th' },
      { char: '🇵🇭', name: 'Philippines', kw: 'philippines filipina ph' },
      { char: '🇻🇳', name: 'Vietnam', kw: 'vietnam vn' },
      { char: '🇯🇵', name: 'Japan', kw: 'japan jepang jp' },
      { char: '🇰🇷', name: 'South Korea', kw: 'korea kr' },
      { char: '🇨🇳', name: 'China', kw: 'china cina cn' },
      { char: '🇮🇳', name: 'India', kw: 'india in' },
      { char: '🇸🇦', name: 'Saudi Arabia', kw: 'saudi arab sa' },
      { char: '🇦🇪', name: 'United Arab Emirates', kw: 'uae dubai ae' },
      { char: '🇦🇺', name: 'Australia', kw: 'australia au' },
      { char: '🇺🇸', name: 'United States', kw: 'usa us america amerika' },
      { char: '🇬🇧', name: 'United Kingdom', kw: 'uk gb britain inggris' },
      { char: '🏁', name: 'Chequered flag', kw: 'finish selesai bendera' },
    ],
  },
]

const EMOJI_BY_CHAR = new Map()
for (const cat of EMOJI_CATEGORIES) {
  for (const item of cat.emojis) {
    if (!EMOJI_BY_CHAR.has(item.char)) EMOJI_BY_CHAR.set(item.char, item)
  }
}

export function lookupEmoji(char) {
  return EMOJI_BY_CHAR.get(char) ?? { char, name: char, kw: '' }
}

export function loadRecentEmojis() {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY)
    if (!raw) return [...DEFAULT_RECENT_EMOJIS]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_RECENT_EMOJIS]
    const valid = parsed.filter((c) => typeof c === 'string' && c.length > 0).slice(0, MAX_RECENT)
    return valid.length ? valid : [...DEFAULT_RECENT_EMOJIS]
  } catch {
    return [...DEFAULT_RECENT_EMOJIS]
  }
}

export function pushRecentEmoji(list, char) {
  const next = [char, ...list.filter((c) => c !== char)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked */
  }
  return next
}

export function filterEmojis(query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const cat of EMOJI_CATEGORIES) {
    for (const item of cat.emojis) {
      if (
        item.char === q ||
        item.name.toLowerCase().includes(q) ||
        item.kw.toLowerCase().includes(q)
      ) {
        out.push(item)
      }
    }
  }
  return out
}
