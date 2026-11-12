/** Auto date presets for template variables. Order is the order shown in the picker. */
export const AUTO_PRESETS = [
  'dateMonthYear',
  'monthName',
  'year',
  'monthNum',
  'monthYear',
  'dayName',
  'numericDate',
]

const LOCALES = { id: 'id-ID', en: 'en-US' }

export function isAutoPreset(value) {
  return AUTO_PRESETS.includes(value)
}

/** App language is mirrored onto <html lang> by applyLang(); fall back to Indonesian. */
export function currentLang() {
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    return document.documentElement.lang
  }
  return 'id'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Value for an auto date variable. `preset` is one of AUTO_PRESETS; anything else returns ''.
 * Month/day names follow the app language. Numeric presets are always dd/MM/yyyy style.
 */
export function formatAutoDate(preset, date = new Date(), lang = currentLang()) {
  if (!isAutoPreset(preset)) return ''
  const locale = LOCALES[lang] ?? LOCALES.en
  const fmt = (options) => new Intl.DateTimeFormat(locale, options).format(date)
  switch (preset) {
    case 'dateMonthYear':
      return fmt({ day: 'numeric', month: 'long', year: 'numeric' })
    case 'monthName':
      return fmt({ month: 'long' })
    case 'year':
      return fmt({ year: 'numeric' })
    case 'monthNum':
      return pad2(date.getMonth() + 1)
    case 'monthYear':
      return pad2(date.getMonth() + 1) + '/' + date.getFullYear()
    case 'dayName':
      return fmt({ weekday: 'long' })
    case 'numericDate':
      return pad2(date.getDate()) + '/' + pad2(date.getMonth() + 1) + '/' + date.getFullYear()
    default:
      return ''
  }
}
