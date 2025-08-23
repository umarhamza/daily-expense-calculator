<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSwipe } from '@vueuse/core'
import BottomNav from './components/BottomNav.vue'
import DayView from './components/DayView.vue'
import MonthView from './components/MonthView.vue'
import ChatModal from './components/ChatModal.vue'

const currentView = ref('day') // 'day' | 'month'
const isChatOpen = ref(false)

function handleNavigate(target) {
  if (target === 'chat') { isChatOpen.value = true; return }
  currentView.value = target
}

const todayIso = new Date().toISOString().slice(0, 10)
const selectedDate = ref(todayIso)

const monthOfSelected = computed(() => selectedDate.value.slice(0, 7) + '-01')

const container = ref(null)
const { direction, isSwiping } = useSwipe(container, { threshold: 30 })

onMounted(() => {
  // no-op
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

  // Month View: retain existing left/right behavior to switch views
  if (direction.value === 'left') currentView.value = currentView.value === 'day' ? 'month' : 'day'
  if (direction.value === 'right') currentView.value = currentView.value === 'month' ? 'day' : 'month'
}
</script>

<template>
  <div ref="container" @touchend="handleSwipe" class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-16">
    <main class="mx-auto max-w-md px-4 pt-4">
      <component :is="currentView === 'day' ? DayView : MonthView"
        :date="selectedDate"
        :monthDate="monthOfSelected"
        @changeDate="d => (selectedDate = d)"
      />
    </main>

    <BottomNav :current="currentView" @navigate="handleNavigate" />

    <ChatModal :isOpen="isChatOpen" @close="isChatOpen = false" />
  </div>
</template>

<style scoped>
</style>
