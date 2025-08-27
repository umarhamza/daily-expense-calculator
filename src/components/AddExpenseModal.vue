<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['close', 'save'])
const props = defineProps({
	isOpen: { type: Boolean, default: false },
	defaultDate: { type: String, required: true },
})

const item = ref('')
const cost = ref('')
const quantity = ref(1)
const suggestions = ['Bread', 'Milk', 'Coffee', 'Groceries', 'Taxi', 'Dinner', 'Snacks']

function normalizeCostString(input) {
	const raw = String(input ?? '')
	const replaced = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
	const parts = replaced.split('.')
	if (parts.length > 2) {
		return parts[0] + '.' + parts.slice(1).join('').replace(/\./g, '')
	}
	return replaced
}

function onCostInput(val) {
	cost.value = normalizeCostString(val)
}

const isValid = computed(() => {
  const qn = Number.parseInt(quantity.value, 10)
  return !!item.value && cost.value.trim() !== '' && !Number.isNaN(Number.parseFloat(cost.value)) && Number.isFinite(qn) && qn > 0
})

function handleSave() {
	const parsed = Number.parseFloat(cost.value)
	const qn = Number.parseInt(quantity.value, 10)
	if (!item.value || Number.isNaN(parsed) || !Number.isFinite(qn) || qn <= 0) return
	emit('save', { item: item.value, cost: parsed, quantity: qn, date: props.defaultDate })
	item.value = ''
	cost.value = ''
	quantity.value = 1
}
</script>

<template>
	<v-dialog
		:model-value="isOpen"
		@update:model-value="val => { if (!val) $emit('close') }"
	>
		<v-card>
			<v-card-title class="d-flex align-center justify-space-between">
				<span class="text-h6">Add Expense</span>
				<v-btn icon="mdi-close" variant="text" @click="$emit('close')" aria-label="Close" />
			</v-card-title>
			<v-card-text class="pt-0">
				<v-combobox
					v-model="item"
					:items="suggestions"
					label="Item"
					variant="outlined"
					hide-details="auto"
					:auto-select-first="false"
					:return-object="false"
					:chips="false"
					:multiple="false"
					:menu-props="{ closeOnContentClick: true }"
				/>
				<v-text-field
					v-model.number="quantity"
					label="Quantity"
					type="number"
					min="1"
					step="1"
					variant="outlined"
					hide-details="auto"
					class="mt-3"
				/>
				<v-text-field
					v-model="cost"
					label="Cost"
					inputmode="decimal"
					variant="outlined"
					hide-details="auto"
					@update:model-value="onCostInput"
					class="mt-3"
				/>
			</v-card-text>
			<v-card-actions class="justify-end">
				<v-btn variant="text" @click="$emit('close')">Cancel</v-btn>
				<v-btn color="primary" :disabled="!isValid" @click="handleSave">Save</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>