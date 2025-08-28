<script setup>
import { ref, onMounted } from "vue";
import { getProfile, updateProfile, updateUserPassword, supabase } from "@/lib/supabase";
import { addToast, showErrorToast } from "@/lib/toast";
import PwaInstall from "@/components/PwaInstall.vue";

const props = defineProps({ userId: { type: String, required: true } });

const isLoading = ref(true);
const displayName = ref("");
const currencySymbol = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

// currency dropdown and quick picks removed per @0008 plan

// Detect mobile/touch-capable environment for showing PWA install section
const isMobileEnv =
  typeof navigator !== "undefined" &&
  (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

async function loadProfile() {
  if (!props.userId) {
    isLoading.value = false;
    return;
  }
  const { data, error } = await getProfile(props.userId);
  if (error) {
    showErrorToast(error.message);
    isLoading.value = false;
    return;
  }
  displayName.value = data?.display_name ?? "";
  currencySymbol.value =
    typeof data?.currency_symbol === "string" ? data.currency_symbol : "";
  isLoading.value = false;
}

async function saveDisplayName() {
  const trimmed = displayName.value.trim();
  if (!trimmed || trimmed.length > 64) {
    showErrorToast("Display name must be 1–64 characters");
    return;
  }
  const { error } = await updateProfile(props.userId, {
    display_name: trimmed,
  });
  if (error) {
    showErrorToast(error.message);
    return;
  }
  try {
    localStorage.setItem("display_name", trimmed);
  } catch (_) {}
  addToast({
    type: "success",
    title: "Saved",
    message: "Display name updated",
  });
}

async function savePassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    showErrorToast("Password must be at least 6 characters");
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    showErrorToast("Passwords do not match");
    return;
  }
  const { error } = await updateUserPassword(newPassword.value);
  if (error) {
    showErrorToast(error.message);
    return;
  }
  newPassword.value = "";
  confirmPassword.value = "";
  addToast({
    type: "success",
    title: "Password updated",
    message: "Your password has been changed. You may need to re-login.",
  });
}

async function saveSymbol() {
  const symbol = currencySymbol.value.trim();
  if (symbol && (symbol.length < 1 || symbol.length > 4)) {
    showErrorToast("Symbol must be 1–4 characters");
    return;
  }
  const { error } = await updateProfile(props.userId, {
    currency_symbol: symbol || null,
  });
  if (error) {
    showErrorToast(error.message);
    return;
  }
  try {
    localStorage.removeItem("currency");
  } catch (_) {}
  try {
    symbol
      ? localStorage.setItem("currency_symbol", symbol)
      : localStorage.removeItem("currency_symbol");
  } catch (_) {}
  addToast({ type: "success", title: "Saved", message: "Symbol updated" });
}

onMounted(loadProfile);

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showErrorToast(error.message);
    return;
  }
  addToast({ type: "info", title: "Signed out", message: "You have been logged out." });
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-h6">Settings</h1>

    <v-skeleton-loader v-if="isLoading" type="article" />

    <v-card v-else>
      <v-card-text>
        <div class="mb-4">
          <div class="font-weight-medium mb-2">Profile</div>
          <v-text-field
            v-model="displayName"
            label="Display Name"
            counter="64"
          />
          <v-btn color="primary" @click="saveDisplayName">Save</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-4">
          <div class="font-weight-medium mb-2">Security</div>
          <v-text-field
            v-model="newPassword"
            type="password"
            label="New Password"
          />
          <v-text-field
            v-model="confirmPassword"
            type="password"
            label="Confirm New Password"
          />
          <v-btn color="primary" @click="savePassword">Update Password</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-4">
          <div class="font-weight-medium mb-2">Preferences</div>
          <v-text-field
            v-model="currencySymbol"
            label="Currency symbol (optional)"
            placeholder="$ or D"
            hint="Use a custom symbol like D; leave blank for none"
            persistent-hint
          />
          <v-btn color="primary" @click="saveSymbol">Save</v-btn>
        </div>

        <v-divider class="my-4" />

        <div class="mb-2" v-if="isMobileEnv">
          <div class="font-weight-medium mb-2">PWA</div>
          <PwaInstall />
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="justify-end">
        <v-btn color="secondary" variant="tonal" @click="logout">Logout</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>
