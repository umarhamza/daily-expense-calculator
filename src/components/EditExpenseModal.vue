<script setup>
import { ref, watch, computed } from 'vue'

const emit = defineEmits(['close', 'save', 'delete'])
const props = defineProps({
	isOpen: { type: Boolean, default: false },
	expense: { type: Object, required: true }, // { id, item, cost, date }
})

const item = ref('')
const cost = ref('')
const date = ref('')
const quantity = ref(1)

watch(() => props.expense, (e) => {
	if (!e) return
	item.value = e.item ?? ''
	cost.value = Number.isFinite(e.cost) ? String(e.cost) : ''
	date.value = e.date ?? ''
	quantity.value = Number.isFinite(e.quantity) && e.quantity > 0 ? e.quantity : 1
}, { immediate: true })

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

const isValid = computed(() => !!item.value && cost.value.trim() !== '' && !Number.isNaN(Number.parseFloat(cost.value)) && /^\d{4}-\d{2}-\d{2}$/.test(date.value) && Number.isFinite(Number.parseInt(quantity.value, 10)) && Number.parseInt(quantity.value, 10) > 0)

function handleSave() {
	const parsedCost = Number.parseFloat(cost.value)
	if (!isValid.value) return
	const qn = Number.parseInt(quantity.value, 10)
	emit('save', { id: props.expense.id, item: item.value, cost: parsedCost, quantity: qn, date: date.value })
}

function handleDelete() {
	emit('delete', { id: props.expense.id })
}
</script>

<template>
	<v-dialog
		:model-value="isOpen"
		@update:model-value="val => { if (!val) $emit('close') }"
	>
		<v-card>
			<v-card-title class="d-flex align-center justify-space-between">
				<span class="text-h6">Edit Expense</span>
				<v-btn icon="mdi-close" variant="text" @click="$emit('close')" aria-label="Close" />
			</v-card-title>
			<v-card-text class="pt-0">
				<v-text-field
					v-model="item"
					label="Item"
					variant="outlined"
					hide-details="auto"
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
				<v-text-field
					v-model="date"
					label="Date"
					type="date"
					variant="outlined"
					hide-details="auto"
					class="mt-3"
				/>
			</v-card-text>
			<v-card-actions class="justify-space-between">
				<v-btn variant="text" @click="$emit('close')">Cancel</v-btn>
				<div>
					<v-btn color="primary" class="mr-2" :disabled="!isValid" @click="handleSave">Save</v-btn>
					<v-btn color="error" variant="outlined" @click="handleDelete">Delete</v-btn>
				</div>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>