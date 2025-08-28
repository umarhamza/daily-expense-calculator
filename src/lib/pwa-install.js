/**
 * Minimal singleton to cache the deferred beforeinstallprompt event.
 * Inputs: event object from `beforeinstallprompt` via setDeferredPrompt(e).
 * Returns: getDeferredPrompt() returns the cached event or null.
 * Throws: nothing. Consumers should check for null before using.
 */
let cachedDeferredPrompt = null

function setDeferredPrompt(event) {
  cachedDeferredPrompt = event || null
}

function getDeferredPrompt() {
  return cachedDeferredPrompt
}

function clearDeferredPrompt() {
  cachedDeferredPrompt = null
}

export { setDeferredPrompt, getDeferredPrompt, clearDeferredPrompt }


