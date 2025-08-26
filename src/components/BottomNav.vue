<script setup>
const emit = defineEmits(['navigate'])
const props = defineProps({ current: { type: String, default: 'day' } })
function handleNav(target) { emit('navigate', target) }
</script>

<template>
  <v-bottom-navigation
    class="fixed bottom-0 left-0 right-0"
    grow
    mode="shift"
    elevation="4"
  >
    <v-btn :color="props.current === 'day' ? 'primary' : undefined" prepend-icon="mdi-calendar-today" @click="handleNav('day')">Day</v-btn>
    <v-btn :color="props.current === 'month' ? 'primary' : undefined" prepend-icon="mdi-calendar-month" @click="handleNav('month')">Month</v-btn>
    <v-btn :color="props.current === 'chat' ? 'primary' : undefined" prepend-icon="mdi-chat" @click="handleNav('chat')">Chat</v-btn>
  </v-bottom-navigation>
</template>