<script setup>
import { ref, computed, watchEffect, watch } from "vue";
import AddExpenseModal from "./AddExpenseModal.vue";
import { fetchExpensesByDate, insertExpense } from "@/lib/supabase";
import { formatDay } from "@/lib/date";
import { formatCurrency } from "@/lib/currency";

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
  currency: { type: String, default: 'USD' },
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
  const isPrevious = props.date < lastDate.value;
  isLoading.value = isPrevious;
  const { data, error } = await fetchExpensesByDate(props.userId, props.date);
  if (error) showErrorToast(error.message);
  expenses.value = data ?? [];
  isLoading.value = false;
  lastDate.value = props.date;
});

// Silent refetch on refreshKey changes without showing loading skeletons
watch(() => props.refreshKey, async () => {
  if (!props.userId || !props.date) return;
  const { data, error } = await fetchExpensesByDate(props.userId, props.date);
  if (error) showErrorToast(error.message);
  expenses.value = data ?? [];
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
  <div>
    <v-row class="mb-4" align="center" justify="space-between">
      <v-col cols="auto">
        <h1 class="text-h6">{{ formattedDate }}</h1>
      </v-col>
      <v-col cols="auto">
        <v-btn
          v-if="date !== new Date().toISOString().slice(0, 10)"
          variant="text"
          density="comfortable"
          @click="goToday"
        >
          Today
        </v-btn>
      </v-col>
    </v-row>

    <div>
      <template v-if="isLoading">
        <v-skeleton-loader
          v-for="i in 5"
          :key="i"
          type="list-item"
          class="mb-2"
        />
      </template>

      <template v-else>
        <v-list v-if="expenses.length" lines="one" density="comfortable">
          <template v-for="(e, i) in expenses" :key="e.id ?? i">
            <v-list-item @click="openEdit(e)">
              <v-list-item-title>{{ e.item }}</v-list-item-title>
              <template #append>
                <div class="font-weight-medium">{{ formatCurrency(e.cost, props.currency) }}</div>
              </template>
            </v-list-item>
            <v-divider v-if="i < expenses.length - 1" />
          </template>
        </v-list>
        <v-alert v-else type="info" variant="tonal" density="comfortable" class="text-center py-8">
          No expenses yet
        </v-alert>
      </template>
    </div>

    <v-row class="mt-6" align="center" justify="space-between">
      <v-col cols="auto">
        <div class="font-weight-medium">Total</div>
      </v-col>
      <v-col cols="auto">
        <div v-if="!isLoading" class="font-weight-medium">{{ formatCurrency(total, props.currency) }}</div>
        <v-skeleton-loader v-else type="text" width="80" />
      </v-col>
    </v-row>

    <v-btn
      color="primary"
      variant="elevated"
      :icon="true"
      @click="openModal"
      :style="{ position: 'fixed', right: '16px', bottom: '64px', zIndex: 10 }"
      aria-label="Add expense"
    >
      <v-icon icon="mdi-plus" />
    </v-btn>

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
