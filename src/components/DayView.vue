<script setup>
import { ref, computed, watchEffect } from "vue";
import AddExpenseModal from "./AddExpenseModal.vue";
import { fetchExpensesByDate, insertExpense } from "@/lib/supabase";
import { formatDay } from "@/lib/date";

// Edit modal state
import EditExpenseModal from "./EditExpenseModal.vue";
import { updateExpense, deleteExpense } from "@/lib/supabase";
import { showErrorToast } from "@/lib/toast";
const isEditOpen = ref(false);
const selectedExpense = ref(null);

const props = defineProps({
  date: { type: String, required: true },
  userId: { type: String, required: true },
  refreshKey: { type: Number, default: 0 },
});
const emit = defineEmits(["changeDate"]);

const expenses = ref([]);
const isModalOpen = ref(false);
const isLoading = ref(false);
const lastDate = ref(props.date);

watchEffect(async () => {
  if (!props.userId || !props.date) {
    expenses.value = [];
    return;
  }
  const isPrevious = props.date < lastDate.value || props.refreshKey !== 0;
  isLoading.value = isPrevious;
  const { data, error } = await fetchExpensesByDate(props.userId, props.date);
  if (error) showErrorToast(error.message);
  expenses.value = data ?? [];
  isLoading.value = false;
  lastDate.value = props.date;
});

function openModal() {
  isModalOpen.value = true;
}
function closeModal() {
  isModalOpen.value = false;
}
async function addExpense(e) {
  const { data, error } = await insertExpense(props.userId, e);
  if (error) showErrorToast(error.message);
  if (data) expenses.value = [data, ...expenses.value];
  closeModal();
}

function openEdit(expense) {
  selectedExpense.value = { ...expense };
  isEditOpen.value = true;
}
function closeEdit() {
  isEditOpen.value = false;
  selectedExpense.value = null;
}
async function saveEdit(updated) {
  const { data, error } = await updateExpense(props.userId, updated.id, {
    item: updated.item,
    cost: updated.cost,
    date: updated.date,
  });
  if (error) showErrorToast(error.message);
  if (data) {
    const idx = expenses.value.findIndex((e) => e.id === data.id);
    if (idx !== -1) expenses.value.splice(idx, 1, data);
  }
  closeEdit();
}
async function confirmAndDelete(toDelete) {
  if (!toDelete?.id) return;
  const ok = window.confirm("Are you sure you want to delete this item?");
  if (!ok) return;
  const { error } = await deleteExpense(props.userId, toDelete.id);
  if (error) showErrorToast(error.message);
  if (!error) {
    expenses.value = expenses.value.filter((e) => e.id !== toDelete.id);
  }
  closeEdit();
}

const total = computed(() => expenses.value.reduce((s, e) => s + e.cost, 0));
const formattedDate = computed(() => formatDay(props.date));
function goToday() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  emit("changeDate", iso);
}
</script>

<template>
  <div class="pb-16">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">{{ formattedDate }}</h1>
      <button
        class="text-sm text-blue-600"
        v-if="date !== new Date().toISOString().slice(0, 10)"
        @click="goToday"
      >
        Today
      </button>
    </header>

    <div class="space-y-2">
      <template v-if="isLoading">
        <div
          v-for="i in 5"
          :key="i"
          class="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 animate-pulse"
        >
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="(e, i) in expenses"
          :key="e.id ?? i"
          class="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3"
          @click="openEdit(e)"
        >
          <div class="font-medium">{{ e.item }}</div>
          <div class="text-gray-700 dark:text-gray-200">
            D{{ e.cost.toFixed(2) }}
          </div>
        </div>
        <div
          v-if="!expenses.length"
          class="text-center text-gray-400 dark:text-gray-400 py-10"
        >
          No expenses yet
        </div>
      </template>
    </div>

    <div
      class="mt-6 flex items-center justify-between text-gray-800 dark:text-gray-200"
    >
      <div class="font-semibold">Total</div>
      <div class="font-semibold" v-if="!isLoading">D{{ total.toFixed(2) }}</div>
      <div
        v-else
        class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
      ></div>
    </div>

    <button
      class="fixed bottom-16 right-4 bg-blue-600 text-white rounded-full w-12 h-12 text-2xl shadow-lg"
      @click="openModal"
    >
      +
    </button>

    <AddExpenseModal
      :isOpen="isModalOpen"
      :defaultDate="date"
      @close="closeModal"
      @save="addExpense"
    />
    <EditExpenseModal
      v-if="selectedExpense"
      :isOpen="isEditOpen"
      :expense="selectedExpense"
      @close="closeEdit"
      @save="saveEdit"
      @delete="confirmAndDelete"
    />
  </div>
</template>
