<script setup>
import { ref, computed, onMounted } from "vue";
import { useSwipe } from "@vueuse/core";
import BottomNav from "./components/BottomNav.vue";
import DayView from "./components/DayView.vue";
import MonthView from "./components/MonthView.vue";
import ChatPage from "./components/ChatPage.vue";
import AuthForm from "./components/AuthForm.vue";
import SettingsPage from "./components/SettingsPage.vue";
import { getProfile } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import Toasts from "./components/Toasts.vue";

const currentView = ref("day"); // 'day' | 'month' | 'chat' | 'settings'

function handleNavigate(target) {
  currentView.value = target;
}

const todayIso = new Date().toISOString().slice(0, 10);
const selectedDate = ref(todayIso);

const monthOfSelected = computed(() => selectedDate.value.slice(0, 7) + "-01");

const refreshKey = ref(0);
const currencySymbol = ref("");
const isAppReady = ref(false);

const container = ref(null);
const { direction, isSwiping } = useSwipe(container, { threshold: 30 });

onMounted(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    session.value = data.session;
    supabase.auth.onAuthStateChange((_, s) => {
      session.value = s;
    });
    if (session.value?.user?.id) {
      try {
        const { data: profile } = await getProfile(session.value.user.id);
        if (typeof profile?.currency_symbol === "string")
          currencySymbol.value = profile.currency_symbol;
      } catch (_) {}
    }
  } finally {
    isAppReady.value = true;
  }
});

/**
 * Returns ISO date string for the previous calendar day relative to provided ISO date.
 */
function getPreviousIsoDate(isoDate) {
  const ms = Date.parse(isoDate);
  const prev = new Date(ms - 24 * 60 * 60 * 1000);
  return prev.toISOString().slice(0, 10);
}

/**
 * Returns ISO date string for the next calendar day relative to provided ISO date.
 */
function getNextIsoDate(isoDate) {
  const ms = Date.parse(isoDate);
  const next = new Date(ms + 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

const currentMonthStart = todayIso.slice(0, 7) + "-01";

/**
 * Returns ISO date string (YYYY-MM-01) for the first day of the previous month.
 * Input should be an ISO date string. Typically pass a month-start string.
 */
function getPreviousMonthStart(isoDate) {
  const date = new Date(isoDate);
  const prev = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)
  );
  return prev.toISOString().slice(0, 10);
}

/**
 * Returns ISO date string (YYYY-MM-01) for the first day of the next month.
 * Input should be an ISO date string. Typically pass a month-start string.
 */
function getNextMonthStart(isoDate) {
  const date = new Date(isoDate);
  const next = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  );
  return next.toISOString().slice(0, 10);
}

function handleSwipe() {
  if (!isSwiping.value) return;

  // Day View: left = previous day; right = next day (not beyond today)
  if (currentView.value === "day") {
    if (direction.value === "left") {
      selectedDate.value = getPreviousIsoDate(selectedDate.value);
    }
    if (direction.value === "right") {
      if (selectedDate.value === todayIso) return;
      const next = getNextIsoDate(selectedDate.value);
      selectedDate.value = next > todayIso ? todayIso : next;
    }
    return;
  }

  // Month View: left = previous month; right = next month (not beyond current month)
  if (currentView.value === "month") {
    if (direction.value === "left") {
      selectedDate.value = getPreviousMonthStart(monthOfSelected.value);
    }
    if (direction.value === "right") {
      if (monthOfSelected.value === currentMonthStart) return;
      const nextMonth = getNextMonthStart(monthOfSelected.value);
      selectedDate.value =
        nextMonth > currentMonthStart ? currentMonthStart : nextMonth;
    }
  }
}

function handleAddedFromChat(payload) {
  const addedDate = String(payload?.date || "").slice(0, 10);
  if (addedDate && addedDate !== selectedDate.value)
    selectedDate.value = addedDate;
  refreshKey.value++;
}

const session = ref(null);
const userId = computed(() => session.value?.user?.id);

async function logout() {
  await supabase.auth.signOut();
}
</script>

<template>
  <v-app>
    <div
      v-if="!isAppReady"
      class="fixed inset-0 z-50 grid place-items-center bg-white"
    >
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>
    <div v-if="!session" v-show="isAppReady" class="min-h-screen bg-gray-50">
      <AuthForm />
    </div>
    <div
      v-else
      v-show="isAppReady"
      ref="container"
      @touchend="handleSwipe"
      class="min-h-screen bg-gray-50 text-gray-900 pb-16"
    >
      <v-btn
        class="fixed top-2 right-2"
        size="small"
        variant="text"
        @click="logout"
        >Logout</v-btn
      >
      <main class="mx-auto max-w-md px-3 pt-3">
        <component
          :is="
            currentView === 'day'
              ? DayView
              : currentView === 'month'
              ? MonthView
              : currentView === 'chat'
              ? ChatPage
              : SettingsPage
          "
          v-bind="
            currentView === 'settings'
              ? { userId }
              : currentView === 'day'
              ? { date: selectedDate, userId, refreshKey, currencySymbol }
              : currentView === 'month'
              ? { monthDate: monthOfSelected, userId, currencySymbol }
              : {}
          "
          @changeDate="(d) => (selectedDate = d)"
          @added="handleAddedFromChat"
        />
      </main>

      <BottomNav :current="currentView" @navigate="handleNavigate" />
    </div>
    <Toasts />
  </v-app>
</template>

<style scoped></style>
