<script setup>
import { ref } from "vue";
import { supabase } from "@/lib/supabase";
import { showErrorToast } from "@/lib/toast";

const email = ref("");
const password = ref("");
const mode = ref("signin");
const isLoading = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");

async function handleSubmit() {
  errorMessage.value = "";
  infoMessage.value = "";
  isLoading.value = true;
  try {
    if (mode.value === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      });
      if (error) {
        errorMessage.value = error.message;
        showErrorToast(error.message);
        return;
      }
      infoMessage.value = "Check your email to confirm your account.";
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) {
        errorMessage.value = error.message;
        showErrorToast(error.message);
        return;
      }
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen grid place-items-center">
    <form
      class="w-full max-w-sm bg-white p-6 rounded-lg shadow"
      @submit.prevent="handleSubmit"
    >
      <h1 class="text-xl font-semibold mb-4">
        {{ mode === "signin" ? "Sign In" : "Sign Up" }}
      </h1>

      <div class="space-y-3">
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="email"
          placeholder="Email"
          v-model="email"
          required
        />
        <input
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="password"
          placeholder="Password"
          v-model="password"
          required
        />
      </div>

      <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
        {{ errorMessage }}
      </div>
      <div v-if="infoMessage" class="mt-3 text-sm text-green-600">
        {{ infoMessage }}
      </div>

      <button
        class="w-full bg-blue-600 text-white font-medium py-2 rounded-md mt-4 disabled:opacity-50"
        :disabled="isLoading"
        type="submit"
      >
        {{
          isLoading
            ? "Please wait..."
            : mode === "signin"
            ? "Sign In"
            : "Create Account"
        }}
      </button>

      <button
        type="button"
        class="w-full text-sm text-blue-600 mt-3"
        @click="mode = mode === 'signin' ? 'signup' : 'signin'"
      >
        {{
          mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"
        }}
      </button>
    </form>
  </div>
</template>
