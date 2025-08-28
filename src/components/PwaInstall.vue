<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { addToast } from '@/lib/toast'

const canInstall = ref(false)
const deferredPrompt = ref(null)
const isStandalone = ref(false)
const infoMessage = ref('')
const isMobile = ref(false)
const isIOS = ref(false)

const emit = defineEmits(['installed'])

function handleBeforeInstallPrompt(e) {
  e.preventDefault()
  deferredPrompt.value = e
  canInstall.value = true
  infoMessage.value = ''
}

function handleAppInstalled() {
  canInstall.value = false
  deferredPrompt.value = null
  addToast({ type: 'success', title: 'Installed', message: 'App installed successfully' })
  emit('installed')
}

async function install() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const choice = await deferredPrompt.value.userChoice
  if (choice?.outcome === 'accepted') {
    canInstall.value = false
  }
}

onMounted(() => {
  const mq = window.matchMedia('(display-mode: standalone)')
  isStandalone.value = mq.matches

  const ua = navigator.userAgent || ''
  isMobile.value = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
  isIOS.value = /iPad|iPhone|iPod/i.test(ua)

  if (isMobile.value && !isStandalone.value) {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { once: true })
    window.addEventListener('appinstalled', handleAppInstalled)
  }

  // Guidance when BIP won't fire (e.g., iOS Safari) after slight delay
  setTimeout(() => {
    if (!isStandalone.value && isMobile.value && !canInstall.value && !deferredPrompt.value) {
      infoMessage.value = isIOS.value
        ? 'On iOS, use Share → Add to Home Screen.'
        : 'Install not available yet in this browser. Try again later.'
    }
  }, 1500)
})

onBeforeUnmount(() => {
  if (isMobile.value) {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  }
})
</script>

<template>
  <div>
    <v-alert v-if="isStandalone" type="success" variant="tonal" density="comfortable">App is installed</v-alert>
    <div v-else>
      <div v-if="isMobile" class="d-flex align-center" style="gap: 8px;">
        <v-btn v-if="canInstall" color="primary" @click="install">Install App</v-btn>
        <span v-else-if="infoMessage" class="text-caption text-medium-emphasis">{{ infoMessage }}</span>
      </div>
      <!-- Desktop: no CTA or guidance per requirement -->
    </div>
  </div>
</template>

