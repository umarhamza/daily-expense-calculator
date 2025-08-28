<script setup>
import { ref } from "vue";
import { supabase } from "@/lib/supabase";

const emit = defineEmits(["forgot"]);

const email = ref("");
const password = ref("");
const mode = ref("signin");
const isLoading = ref(false);
const errorMessage = ref("");
const infoMessage = ref("");
const showPassword = ref(false);

const emailRef = ref(null);
const passwordRef = ref(null);

function validateInputs() {
  errorMessage.value = "";

  const trimmedEmail = String(email.value || "").trim();
  const hasEmail = trimmedEmail.length > 0;
  const emailLooksValid = /\S+@\S+\.\S+/.test(trimmedEmail);
  const hasPassword = String(password.value || "").length > 0;
  const passwordLongEnough = String(password.value || "").length >= 8;

  if (!hasEmail) {
    errorMessage.value = "Email is required";
    emailRef.value?.focus?.();
    return false;
  }
  if (!emailLooksValid) {
    errorMessage.value = "Enter a valid email";
    emailRef.value?.focus?.();
    return false;
  }
  if (!hasPassword) {
    errorMessage.value = "Password is required";
    passwordRef.value?.focus?.();
    return false;
  }
  if (mode.value === "signup" && !passwordLongEnough) {
    errorMessage.value = "Password must be at least 8 characters";
    passwordRef.value?.focus?.();
    return false;
  }
  return true;
}

async function handleSubmit() {
  errorMessage.value = "";
  infoMessage.value = "";
  if (!validateInputs()) return;
  isLoading.value = true;
  try {
    if (mode.value === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      });
      if (error) {
        errorMessage.value = error.message;
        passwordRef.value?.focus?.();
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
        passwordRef.value?.focus?.();
        return;
      }
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
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
            ref="emailRef"
            v-model="email"
            label="Email"
            type="email"
            autocomplete="email"
            prepend-inner-icon="mdi-email"
            autofocus
            :rules="[
              (v) => !!v || 'Email is required',
              (v) => /\\S+@\\S+\\.\\S+/.test(String(v || '').trim()) || 'Enter a valid email',
            ]"
            required
          />
          <v-text-field
            ref="passwordRef"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            :rules="[
              (v) => !!v || 'Password is required',
              (v) => (mode === 'signup' ? String(v || '').length >= 8 : true) || 'At least 8 characters',
            ]"
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
        <v-btn
          variant="text"
          size="small"
          type="button"
          @click="emit('forgot')"
        >
          Forgot password?
        </v-btn>
      </v-card-actions>
    </v-card>
  </form>
</template>
