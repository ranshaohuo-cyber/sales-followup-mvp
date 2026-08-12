const ACCESS_CODE_KEY = 'store_followup_access_code'

export function getAccessCode() {
  return window.localStorage.getItem(ACCESS_CODE_KEY) || ''
}

export function setAccessCode(value: string) {
  window.localStorage.setItem(ACCESS_CODE_KEY, value.trim())
}

export function clearAccessCode() {
  window.localStorage.removeItem(ACCESS_CODE_KEY)
}

export function accessCodeHeaders(): Record<string, string> {
  const accessCode = getAccessCode()
  return accessCode ? { 'X-Access-Code': accessCode } : {}
}

export function appendAccessCode(url: string) {
  const accessCode = getAccessCode()
  if (!accessCode) return url
  const nextUrl = new URL(url)
  nextUrl.searchParams.set('access_code', accessCode)
  return nextUrl.toString()
}
