<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { addToast } from '@/lib/toast'

const canInstall = ref(false)
const deferredPrompt = ref(null)
const isStandalone = ref(false)

function handleBeforeInstallPrompt(e) {
  e.preventDefault()
  deferredPrompt.value = e
  canInstall.value = true
}

function handleAppInstalled() {
  canInstall.value = false
  deferredPrompt.value = null
  addToast({ type: 'success', title: 'Installed', message: 'App installed successfully' })
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
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<template>
  <div>
    <v-alert v-if="isStandalone" type="success" variant="tonal" density="comfortable">App is installed</v-alert>
    <v-btn v-else :disabled="!canInstall" color="primary" @click="install">
      Install App
    </v-btn>
  </div>
</template>

