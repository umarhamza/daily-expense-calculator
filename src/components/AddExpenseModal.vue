<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['close', 'save'])
const props = defineProps({
	isOpen: { type: Boolean, default: false },
	defaultDate: { type: String, required: true },
})

const item = ref('')
const cost = ref('')
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

const isValid = computed(() => !!item.value && cost.value.trim() !== '' && !Number.isNaN(Number.parseFloat(cost.value)))

function handleSave() {
	const parsed = Number.parseFloat(cost.value)
	if (!item.value || Number.isNaN(parsed)) return
	emit('save', { item: item.value, cost: parsed, date: props.defaultDate })
	item.value = ''
	cost.value = ''
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
				<v-autocomplete
					v-model="item"
					:items="suggestions"
					label="Item"
					variant="outlined"
					hide-details="auto"
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