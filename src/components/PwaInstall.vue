<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { addToast } from '@/lib/toast'

const canInstall = ref(false)
const deferredPrompt = ref(null)
const isStandalone = ref(false)
const infoMessage = ref('')

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
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { once: true })
  window.addEventListener('appinstalled', handleAppInstalled)
  // Guidance when BIP won't fire (e.g., iOS Safari) after slight delay
  setTimeout(() => {
    if (!isStandalone.value && !canInstall.value && !deferredPrompt.value) {
      infoMessage.value = 'Install not available in this browser/context. Try Chrome on Android or desktop.'
    }
  }, 1500)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<template>
  <div>
    <v-alert v-if="isStandalone" type="success" variant="tonal" density="comfortable">App is installed</v-alert>
    <div v-else class="d-flex align-center" style="gap: 8px;">
      <v-btn :disabled="!canInstall" color="primary" @click="install">Install App</v-btn>
      <span v-if="!canInstall && infoMessage" class="text-caption text-medium-emphasis">{{ infoMessage }}</span>
    </div>
  </div>
</template>

