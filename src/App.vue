<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSwipe } from '@vueuse/core'
import BottomNav from './components/BottomNav.vue'
import DayView from './components/DayView.vue'
import MonthView from './components/MonthView.vue'
import ChatModal from './components/ChatModal.vue'
import AuthForm from './components/AuthForm.vue'
import SettingsPage from './components/SettingsPage.vue'
import { getProfile } from '@/lib/supabase'
import { getDefaultCurrency } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import Toasts from './components/Toasts.vue'

const currentView = ref('day') // 'day' | 'month' | 'settings'
const isChatOpen = ref(false)

function handleNavigate(target) {
  if (target === 'chat') { isChatOpen.value = true; return }
  currentView.value = target
}

const todayIso = new Date().toISOString().slice(0, 10)
const selectedDate = ref(todayIso)

const monthOfSelected = computed(() => selectedDate.value.slice(0, 7) + '-01')

const refreshKey = ref(0)
const currency = ref(getDefaultCurrency())

const container = ref(null)
const { direction, isSwiping } = useSwipe(container, { threshold: 30 })

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  supabase.auth.onAuthStateChange((_, s) => { session.value = s })
  if (session.value?.user?.id) {
    try {
      const { data: profile } = await getProfile(session.value.user.id)
      if (profile?.currency && profile.currency.length === 3) currency.value = profile.currency
    } catch (_) {}
  }
})

/**
 * Returns ISO date string for the previous calendar day relative to provided ISO date.
 */
function getPreviousIsoDate(isoDate) {
  const ms = Date.parse(isoDate)
  const prev = new Date(ms - 24 * 60 * 60 * 1000)
  return prev.toISOString().slice(0, 10)
}

/**
 * Returns ISO date string for the next calendar day relative to provided ISO date.
 */
function getNextIsoDate(isoDate) {
  const ms = Date.parse(isoDate)
  const next = new Date(ms + 24 * 60 * 60 * 1000)
  return next.toISOString().slice(0, 10)
}

const currentMonthStart = todayIso.slice(0, 7) + '-01'

/**
 * Returns ISO date string (YYYY-MM-01) for the first day of the previous month.
 * Input should be an ISO date string. Typically pass a month-start string.
 */
function getPreviousMonthStart(isoDate) {
  const date = new Date(isoDate)
  const prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 10)
}

/**
 * Returns ISO date string (YYYY-MM-01) for the first day of the next month.
 * Input should be an ISO date string. Typically pass a month-start string.
 */
function getNextMonthStart(isoDate) {
  const date = new Date(isoDate)
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return next.toISOString().slice(0, 10)
}

function handleSwipe() {
  if (!isSwiping.value) return

  // Day View: left = previous day; right = next day (not beyond today)
  if (currentView.value === 'day') {
    if (direction.value === 'left') {
      selectedDate.value = getPreviousIsoDate(selectedDate.value)
    }
    if (direction.value === 'right') {
      if (selectedDate.value === todayIso) return
      const next = getNextIsoDate(selectedDate.value)
      selectedDate.value = next > todayIso ? todayIso : next
    }
    return
  }

  // Month View: left = previous month; right = next month (not beyond current month)
  if (currentView.value === 'month') {
    if (direction.value === 'left') {
      selectedDate.value = getPreviousMonthStart(monthOfSelected.value)
    }
    if (direction.value === 'right') {
      if (monthOfSelected.value === currentMonthStart) return
      const nextMonth = getNextMonthStart(monthOfSelected.value)
      selectedDate.value = nextMonth > currentMonthStart ? currentMonthStart : nextMonth
    }
  }
}

function handleAddedFromChat(payload) {
  const addedDate = String(payload?.date || '').slice(0, 10)
  if (addedDate && addedDate !== selectedDate.value) selectedDate.value = addedDate
  refreshKey.value++
}

const session = ref(null)
const userId = computed(() => session.value?.user?.id)

async function logout() { await supabase.auth.signOut() }
</script>

<template>
  <v-app>
    <div v-if="!session" class="min-h-screen">
      <AuthForm />
    </div>
    <div v-else ref="container" @touchend="handleSwipe" class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-16">
      <v-btn class="fixed top-2 right-2" size="small" variant="text" @click="logout">Logout</v-btn>
      <main class="mx-auto max-w-md px-3 pt-3">
        <component :is="currentView === 'day' ? DayView : (currentView === 'month' ? MonthView : SettingsPage)"
          v-bind="currentView === 'settings' ? { userId } : (currentView === 'day' ? { date: selectedDate, userId, refreshKey } : { monthDate: monthOfSelected, userId })"
          :currency="currency"
          @changeDate="d => (selectedDate = d)"
        />
      </main>

      <BottomNav :current="currentView" @navigate="handleNavigate" />

      <ChatModal :isOpen="isChatOpen" @close="isChatOpen = false" @added="handleAddedFromChat" />
    </div>
    <Toasts />
  </v-app>
</template>

<style scoped>
</style>
