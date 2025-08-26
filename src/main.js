import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import { vuetify } from '@/plugins/vuetify'

createApp(App).use(vuetify).mount('#app')

// Register service worker for PWA (auto-updates)
registerSW({ immediate: true })
