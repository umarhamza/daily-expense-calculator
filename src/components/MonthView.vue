<script setup>
import { computed, ref, watchEffect } from "vue";
import { fetchExpensesByMonth } from "@/lib/supabase";
import { formatMonth, formatDayShort, getPrevMonthStartIso, getNextMonthStartIsoClampedToCurrent } from "@/lib/date";
import { formatAmount } from "@/lib/currency";
import { showErrorToast } from "@/lib/toast";

const props = defineProps({
  monthDate: { type: String, required: true },
  userId: { type: String, required: true },
  currencySymbol: { type: String, default: "" },
});

const expenses = ref([]);
const emit = defineEmits(["changeDate"]);

watchEffect(async () => {
  if (!props.userId || !props.monthDate) {
    expenses.value = [];
    return;
  }
  const { data, error } = await fetchExpensesByMonth(
    props.userId,
    props.monthDate
  );
  if (error) showErrorToast(error.message);
  expenses.value = data ?? [];
});

/**
 * Extract the base item name by removing trailing quantity suffixes like " x2" or "x3".
 * Input: item string (e.g., "bread x3"). Output: base string (e.g., "bread").
 */
function getBaseItemName(item) {
  if (!item) return "";
  return item.replace(/\s*[xX×]\s*\d+\s*$/u, "").trim();
}

const groups = computed(() => {
  const byBase = new Map();
  for (const e of expenses.value) {
    const base = getBaseItemName(e.item);
    if (!byBase.has(base)) byBase.set(base, { base, items: [], sum: 0 });
    const bucket = byBase.get(base);
    bucket.items.push(e);
    bucket.sum += Number(e?.cost ?? 0);
  }
  const arr = Array.from(byBase.values());
  for (const g of arr) {
    g.items.sort((a, b) => {
      if (a.date === b.date)
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      return b.date.localeCompare(a.date);
    });
    g.count = g.items.length;
  }
  arr.sort((a, b) => a.base.localeCompare(b.base));
  return arr;
});

const grandTotal = computed(() =>
  expenses.value.reduce((sum, row) => sum + Number(row?.cost ?? 0), 0)
);
const formattedMonth = computed(() => formatMonth(props.monthDate));
const currentMonthStart = computed(() => new Date().toISOString().slice(0,7) + '-01');
const isAtCurrentMonth = computed(() => props.monthDate >= currentMonthStart.value);

function goPrevMonth() {
  emit('changeDate', getPrevMonthStartIso(props.monthDate));
}
function goNextMonth() {
  const next = getNextMonthStartIsoClampedToCurrent(props.monthDate);
  emit('changeDate', next);
}
function goCurrentMonth() {
  emit('changeDate', currentMonthStart.value);
}

// Track expanded states by base name; allow multiple open
const expanded = ref(new Set());
function toggleExpanded(base) {
  const next = new Set(expanded.value);
  if (next.has(base)) next.delete(base);
  else next.add(base);
  expanded.value = next;
}
function isExpanded(base) {
  return expanded.value.has(base);
}
</script>

<template>
  <div class="pb-16">
    <div class="mb-2 flex items-center justify-end">
      <v-btn variant="text" density="comfortable" @click="goCurrentMonth" title="Jump to current month">Current Month</v-btn>
    </div>
    <header class="flex items-center justify-center gap-3 mb-4">
      <v-btn icon variant="text" density="comfortable" @click="goPrevMonth" aria-label="Previous month" title="Previous month">
        <v-icon icon="mdi-chevron-left" />
      </v-btn>
      <h1 class="text-xl font-semibold text-center">{{ formattedMonth }}</h1>
      <v-btn icon variant="text" density="comfortable" @click="goNextMonth" :disabled="isAtCurrentMonth" aria-label="Next month" title="Next month">
        <v-icon icon="mdi-chevron-right" />
      </v-btn>
    </header>

    <div class="space-y-2">
      <template v-for="g in groups" :key="g.base">
        <div
          class="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-4 cursor-pointer select-none"
          @click="toggleExpanded(g.base)"
        >
          <div class="font-medium">
            {{ g.base }} <span class="text-gray-500">({{ g.count }})</span>
          </div>
          <div class="text-gray-700 flex items-center gap-2">
            <span>{{
              formatAmount(g.sum, { symbolOverride: props.currencySymbol })
            }}</span>
            <svg
              :class="isExpanded(g.base) ? 'rotate-180' : ''"
              class="w-4 h-4 text-gray-500 transition-transform"
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>
        <div
          class="overflow-hidden transition-all duration-200 bg-white/70 border border-t-0 border-gray-100 rounded-b-lg -mt-2"
          :class="
            isExpanded(g.base) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          "
        >
          <ul class="divide-y divide-gray-100">
            <li
              v-for="e in g.items"
              :key="e.id"
              class="flex items-center justify-between px-4 py-3"
            >
              <div class="text-sm text-gray-500">
                {{ formatDayShort(e.date) }}
              </div>
              <div class="text-sm text-gray-500">
                {{ e.item
                }}<span v-if="e.quantity && e.quantity > 1">
                  ×{{ e.quantity }}</span
                >
              </div>

              <div class="text-sm text-gray-500">
                {{
                  formatAmount(Number(e.cost ?? 0), {
                    symbolOverride: props.currencySymbol,
                  })
                }}
              </div>
            </li>
          </ul>
        </div>
      </template>
      <div v-if="!groups.length" class="text-center text-gray-400 py-10">
        No data for this month
      </div>
    </div>

    <div class="mt-6 flex items-center justify-between text-gray-800">
      <div class="font-semibold">Total</div>
      <div class="font-semibold">
        {{ formatAmount(grandTotal, { symbolOverride: props.currencySymbol }) }}
      </div>
    </div>
  </div>
</template>
