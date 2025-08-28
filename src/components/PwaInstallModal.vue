<template>
  <v-dialog v-model="isOpen" max-width="520" aria-label="PWA install instructions" :aria-labelledby="titleId">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span :id="titleId">PWA Installation</span>
        <v-btn icon="mdi-close" variant="text" @click="close" aria-label="Close" />
      </v-card-title>
      <v-card-text>
        <div class="mb-4">
          <v-chip class="mr-2" size="small">{{ platform.os }}</v-chip>
          <v-chip class="mr-2" size="small">{{ platform.browser }}</v-chip>
          <v-menu>
            <template #activator="{ props }">
              <v-btn v-bind="props" size="small" variant="tonal">Choose platform</v-btn>
            </template>
            <v-list density="compact">
              <v-list-item v-for="opt in options" :key="opt.key" @click="selectOption(opt.key)">
                <v-list-item-title>{{ opt.label }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <div v-if="current.key === 'ios-safari'">
          <ol class="pl-4">
            <li class="mb-2">Tap the Share button.</li>
            <li class="mb-2">Choose “Add to Home Screen”.</li>
            <li class="mb-2">Confirm the name and tap Add.</li>
          </ol>
        </div>
        <div v-else-if="current.key === 'ios-other'">
          <p>Open this page in Safari, then use Share → Add to Home Screen.</p>
        </div>
        <div v-else-if="current.key === 'android-chromium'">
          <ol class="pl-4">
            <li class="mb-2">Open the browser menu (⋮).</li>
            <li class="mb-2">Tap “Install app” or “Add to Home screen”.</li>
            <li class="mb-2">Confirm the install.</li>
          </ol>
        </div>
        <div v-else-if="current.key === 'android-firefox'">
          <ol class="pl-4">
            <li class="mb-2">Open the browser menu.</li>
            <li class="mb-2">Tap “Add to Home screen”.</li>
            <li class="mb-2">Confirm the add.</li>
          </ol>
        </div>
        <div v-else-if="current.key === 'desktop-chromium'">
          <ol class="pl-4">
            <li class="mb-2">Click the Install icon in the address bar, or open the menu.</li>
            <li class="mb-2">Choose “Install app”.</li>
            <li class="mb-2">Confirm.</li>
          </ol>
        </div>
        <div v-else-if="current.key === 'desktop-safari'">
          <ol class="pl-4">
            <li class="mb-2">Use File → Add to Dock… (macOS Sonoma+) or Share → Add to Dock.</li>
            <li class="mb-2">Confirm the app name and Add.</li>
          </ol>
        </div>
        <div v-else-if="current.key === 'desktop-firefox'">
          <p>Firefox has limited PWA install support. Consider using Chrome or Edge.</p>
        </div>
        <div v-else>
          <p>Use your browser’s menu to find “Install app” or “Add to Home screen”.</p>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { detectPlatform } from '@/lib/platform'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const isOpen = computed({
  get() { return props.modelValue },
  set(v) { emit('update:modelValue', v) }
})

const titleId = `pwa-install-title`

const platform = ref(detectPlatform())
watchEffect(() => { platform.value = detectPlatform() })

const options = [
  { key: 'ios-safari', label: 'iOS · Safari' },
  { key: 'ios-other', label: 'iOS · Other Browsers' },
  { key: 'android-chromium', label: 'Android · Chrome/Edge/Brave/Opera' },
  { key: 'android-firefox', label: 'Android · Firefox' },
  { key: 'desktop-chromium', label: 'Desktop · Chrome/Edge/Brave' },
  { key: 'desktop-safari', label: 'Desktop · Safari' },
  { key: 'desktop-firefox', label: 'Desktop · Firefox' },
]

const current = ref({ key: 'generic' })

function selectOption(key) {
  current.value = { key }
}

function autoSelect() {
  const p = platform.value
  if (p.isIos && p.browser === 'safari') return 'ios-safari'
  if (p.isIos) return 'ios-other'
  if (p.isAndroid && (p.browser === 'chrome' || p.browser === 'edge' || p.browser === 'brave' || p.browser === 'opera')) return 'android-chromium'
  if (p.isAndroid && p.browser === 'firefox') return 'android-firefox'
  if (p.isDesktop && (p.browser === 'chrome' || p.browser === 'edge' || p.browser === 'brave' || p.browser === 'opera')) return 'desktop-chromium'
  if (p.isDesktop && p.browser === 'safari') return 'desktop-safari'
  if (p.isDesktop && p.browser === 'firefox') return 'desktop-firefox'
  return 'generic'
}

watchEffect(() => {
  selectOption(autoSelect())
})

function close() {
  isOpen.value = false
}
</script>

<style scoped>
</style>

