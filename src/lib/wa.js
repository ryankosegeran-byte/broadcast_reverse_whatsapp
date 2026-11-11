export function normalizePhone(input) {
  let digits = String(input ?? '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  return digits
}

export function isValidPhone(phone) {
  return /^62\d{6,13}$/.test(phone)
}

export function buildWaUrl(phone, text) {
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
}
