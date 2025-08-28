/**
 * Detect OS and browser for PWA instruction targeting.
 * Inputs: none (reads from navigator/userAgent if available).
 * Returns: { os, browser, isIos, isAndroid, isDesktop }.
 * Throws: nothing.
 */
function detectPlatform() {
  if (typeof navigator === 'undefined') {
    return { os: 'unknown', browser: 'unknown', isIos: false, isAndroid: false, isDesktop: true }
  }

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const ua = userAgent.toLowerCase()

  const isAndroid = /android/.test(ua)
  const isIos = /iphone|ipad|ipod/.test(ua) || (
    // iPadOS 13+ masquerades as Mac; detect touch-capable Mac as iPadOS
    /mac/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 2
  )

  let browser = 'unknown'
  if (/edg\//.test(ua)) browser = 'edge'
  else if (/crios/.test(ua)) browser = 'chrome' // Chrome on iOS UA token
  else if (/chrome\//.test(ua)) browser = 'chrome'
  else if (/safari/.test(ua) && !/chrome|crios|android/.test(ua)) browser = 'safari'
  else if (/firefox|fxios/.test(ua)) browser = 'firefox'
  else if (/brave/.test(ua)) browser = 'brave'
  else if (/opr\//.test(ua)) browser = 'opera'

  const os = isIos ? 'ios' : isAndroid ? 'android' : /win|mac|linux|cros/i.test(platform) ? 'desktop' : 'unknown'
  const isDesktop = os === 'desktop'

  return { os, browser, isIos, isAndroid, isDesktop }
}

export { detectPlatform }

