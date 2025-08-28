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
const showPassword = ref(false);

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
    <form class="w-full max-w-sm" @submit.prevent="handleSubmit">
      <v-card>
        <v-card-title class="text-h6">
          {{ mode === "signin" ? "Sign In" : "Sign Up" }}
        </v-card-title>
        <v-card-subtitle>
          {{ mode === "signin" ? "Welcome back" : "Create your account" }}
        </v-card-subtitle>
        <v-card-text>
          <div class="space-y-3">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              autocomplete="email"
              prepend-inner-icon="mdi-email"
              required
            />
            <v-text-field
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              autocomplete="current-password"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              required
            />
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              density="comfortable"
              aria-live="polite"
            >
              {{ errorMessage }}
            </v-alert>
            <v-alert
              v-if="infoMessage"
              type="info"
              variant="tonal"
              density="comfortable"
              aria-live="polite"
            >
              {{ infoMessage }}
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions class="flex flex-col gap-2">
          <v-btn
            color="primary"
            type="submit"
            :loading="isLoading"
            :disabled="isLoading"
            block
          >
            {{ mode === "signin" ? "Sign In" : "Create Account" }}
          </v-btn>
          <v-btn
            variant="text"
            type="button"
            @click="mode = mode === 'signin' ? 'signup' : 'signin'"
            block
          >
            {{
              mode === "signin"
                ? "Need an account? Sign up"
                : "Have an account? Sign in"
            }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </form>
  </div>
</template>
