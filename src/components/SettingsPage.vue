<script setup>
import { ref, onMounted } from 'vue'
import { getProfile, updateProfile, updateUserPassword } from '@/lib/supabase'
import { addToast, showErrorToast } from '@/lib/toast'

const props = defineProps({ userId: { type: String, required: true } })

const isLoading = ref(true)
const displayName = ref('')
const currency = ref('USD')
const currencySymbol = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']
const symbolQuickPicks = ['$', '€', '£', '¥', 'D']

async function loadProfile() {
  if (!props.userId) { isLoading.value = false; return }
  const { data, error } = await getProfile(props.userId)
  if (error) { showErrorToast(error.message); isLoading.value = false; return }
  displayName.value = data?.display_name ?? ''
  currency.value = (data?.currency && data.currency.length === 3 ? data.currency : 'USD')
  currencySymbol.value = (typeof data?.currency_symbol === 'string' ? data.currency_symbol : '')
  isLoading.value = false
}

async function saveDisplayName() {
  const trimmed = displayName.value.trim()
  if (!trimmed || trimmed.length > 64) { showErrorToast('Display name must be 1–64 characters'); return }
  const { error } = await updateProfile(props.userId, { display_name: trimmed })
  if (error) { showErrorToast(error.message); return }
  try { localStorage.setItem('display_name', trimmed) } catch (_) {}
  addToast({ type: 'success', title: 'Saved', message: 'Display name updated' })
}

async function savePassword() {
  if (!newPassword.value || newPassword.value.length < 6) { showErrorToast('Password must be at least 6 characters'); return }
  if (newPassword.value !== confirmPassword.value) { showErrorToast('Passwords do not match'); return }
  const { error } = await updateUserPassword(newPassword.value)
  if (error) { showErrorToast(error.message); return }
  newPassword.value = ''
  confirmPassword.value = ''
  addToast({ type: 'success', title: 'Password updated', message: 'Your password has been changed. You may need to re-login.' })
}

async function saveCurrency() {
  if (!currencyOptions.includes(currency.value)) { showErrorToast('Invalid currency'); return }
  const symbol = currencySymbol.value.trim()
  if (symbol && (symbol.length < 1 || symbol.length > 4)) { showErrorToast('Symbol must be 1–4 characters'); return }
  const payload = { currency: currency.value, currency_symbol: symbol || null }
  const { error } = await updateProfile(props.userId, payload)
  if (error) { showErrorToast(error.message); return }
  try { localStorage.setItem('currency', currency.value) } catch (_) {}
  try { symbol ? localStorage.setItem('currency_symbol', symbol) : localStorage.removeItem('currency_symbol') } catch (_) {}
  addToast({ type: 'success', title: 'Saved', message: 'Currency updated' })
}

onMounted(loadProfile)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-h6">Settings</h1>

    <v-skeleton-loader v-if="isLoading" type="article" />

    <v-card v-else>
      <v-card-text>
        <div class="mb-4">
          <div class="font-weight-medium mb-2">Profile</div>
          <v-text-field v-model="displayName" label="Display Name" counter="64" />
          <v-btn color="primary" @click="saveDisplayName">Save</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-4">
          <div class="font-weight-medium mb-2">Security</div>
          <v-text-field v-model="newPassword" type="password" label="New Password" />
          <v-text-field v-model="confirmPassword" type="password" label="Confirm New Password" />
          <v-btn color="primary" @click="savePassword">Update Password</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-4">
          <div class="font-weight-medium mb-2">Preferences</div>
          <v-select :items="currencyOptions" v-model="currency" label="Currency" />
          <div class="mt-2">
            <v-text-field v-model="currencySymbol" label="Display symbol (optional)" placeholder="$ or D" hint="Use a custom symbol like D; leave blank to use ISO symbol" persistent-hint />
            <div class="mt-1 d-flex align-center" style="gap: 8px;">
              <span class="text-caption">Quick picks:</span>
              <v-btn size="x-small" variant="tonal" v-for="s in symbolQuickPicks" :key="s" @click="currencySymbol = s">{{ s }}</v-btn>
              <v-btn size="x-small" variant="text" @click="currencySymbol = ''">Clear</v-btn>
            </div>
          </div>
          <v-btn color="primary" @click="saveCurrency">Save</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-2">
          <div class="font-weight-medium mb-2">PWA</div>
          <PwaInstall />
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

