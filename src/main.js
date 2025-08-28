import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import { vuetify } from '@/plugins/vuetify'
import { setDeferredPrompt, clearDeferredPrompt } from '@/lib/pwa-install'

// Capture PWA install events as early as possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  setDeferredPrompt(e)
  window.dispatchEvent(new CustomEvent('pwa:can-install'))
}, { once: true })

window.addEventListener('appinstalled', () => {
  clearDeferredPrompt()
})

createApp(App).use(vuetify).mount('#app')

// Register service worker for PWA (auto-updates)
registerSW({ immediate: true })
