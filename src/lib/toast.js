import { reactive } from 'vue'

/**
 * Minimal toast state and helpers.
 * addToast: Adds a toast and optionally auto-removes after timeout.
 * removeToast: Removes a toast by id.
 * showErrorToast: Convenience for error messages with copy support.
 *
 * Inputs: message (string), title (optional), type ('error'|'success'|'info'), timeout (ms), copyText (string)
 * Outputs: Returns the created toast id from addToast/showErrorToast.
 * Errors: None thrown; invalid inputs result in no-op strings.
 */
const toastState = reactive({ items: [] })

function addToast({ message = '', title = '', type = 'info', timeout = 5000, copyText = '' }) {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
	const toast = { id, message, title, type, copyText, timeout }
	toastState.items.push(toast)
	if (timeout > 0) setTimeout(() => removeToast(id), timeout)
	return id
}

function removeToast(id) {
	const index = toastState.items.findIndex(t => t.id === id)
	if (index !== -1) toastState.items.splice(index, 1)
}

function clearToasts() {
	toastState.items.splice(0, toastState.items.length)
}

function showErrorToast(message) {
	return addToast({ title: 'Error', message: String(message || 'Something went wrong'), type: 'error', timeout: 7000, copyText: String(message || '') })
}

export { toastState, addToast, removeToast, clearToasts, showErrorToast }