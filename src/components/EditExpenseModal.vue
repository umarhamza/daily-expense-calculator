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

watch(() => props.expense, (e) => {
	if (!e) return
	item.value = e.item ?? ''
	cost.value = Number.isFinite(e.cost) ? String(e.cost) : ''
	date.value = e.date ?? ''
}, { immediate: true })

const isValid = computed(() => !!item.value && !Number.isNaN(Number.parseFloat(cost.value)) && /^\d{4}-\d{2}-\d{2}$/.test(date.value))

function handleSave() {
	const parsedCost = Number.parseFloat(cost.value)
	if (!isValid.value) return
	emit('save', { id: props.expense.id, item: item.value, cost: parsedCost, date: date.value })
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
					v-model="cost"
					label="Cost"
					inputmode="decimal"
					variant="outlined"
					hide-details="auto"
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