<script setup>
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const mode = ref('signin') // 'signin' | 'signup'
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  infoMessage.value = ''
  if (!email.value || !password.value) { errorMessage.value = 'Email and password are required'; return }

  isLoading.value = true
  try {
    if (mode.value === 'signup') {
      const { error } = await supabase.auth.signUp({ email: email.value, password: password.value })
      if (error) { errorMessage.value = error.message; return }
      infoMessage.value = 'Check your email to confirm your account.'
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      if (error) { errorMessage.value = error.message; return }
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4">
    <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 shadow">
      <h1 class="text-xl font-semibold mb-4">{{ mode === 'signin' ? 'Log in' : 'Create account' }}</h1>

      <div v-if="errorMessage" class="mb-3 text-sm text-red-600">{{ errorMessage }}</div>
      <div v-if="infoMessage" class="mb-3 text-sm text-green-600">{{ infoMessage }}</div>

      <form @submit.prevent="handleSubmit" class="space-y-3">
        <input
          class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="email"
          autocomplete="email"
          placeholder="Email"
          v-model="email"
        />
        <input
          class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          v-model="password"
        />
        <button
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md"
          :disabled="isLoading"
          type="submit"
        >{{ isLoading ? 'Please wait…' : (mode === 'signin' ? 'Log in' : 'Sign up') }}</button>
      </form>

      <div class="mt-4 text-sm text-gray-600 dark:text-gray-300">
        <button class="text-blue-600 hover:underline" @click="mode = mode === 'signin' ? 'signup' : 'signin'">
          {{ mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Log in' }}
        </button>
      </div>
    </div>
  </div>
</template>