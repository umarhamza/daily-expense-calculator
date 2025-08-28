<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { addToast } from "@/lib/toast";
import { getDeferredPrompt, clearDeferredPrompt } from "@/lib/pwa-install";

const canInstall = ref(false);
const isStandalone = ref(false);
const infoMessage = ref("");
const isMobile = ref(false);
const isIOS = ref(false);

const emit = defineEmits(["installed"]);

function handleAppInstalled() {
  canInstall.value = false;
  clearDeferredPrompt();
  addToast({
    type: "success",
    title: "Installed",
    message: "App installed successfully",
  });
  emit("installed");
}

function handleCanInstall() {
  canInstall.value = true;
  infoMessage.value = "";
}

async function install() {
  const ev = getDeferredPrompt();
  if (ev) {
    ev.prompt();
    const choice = await ev.userChoice;
    if (choice?.outcome === "accepted") canInstall.value = false;
    return;
  }
  infoMessage.value = isIOS.value
    ? "On iOS, use Share → Add to Home Screen."
    : "Install not available yet in this browser. Try again later.";
}

onMounted(() => {
  const mq = window.matchMedia("(display-mode: standalone)");
  isStandalone.value = mq.matches || window.navigator.standalone === true;

  const ua = navigator.userAgent || "";
  const isiPadOSDesktopUA =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  isMobile.value =
    /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || isiPadOSDesktopUA;
  isIOS.value = /iPad|iPhone|iPod/i.test(ua) || isiPadOSDesktopUA;

  if (isMobile.value && !isStandalone.value) {
    if (getDeferredPrompt()) handleCanInstall();
    window.addEventListener("pwa:can-install", handleCanInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
  }

  setTimeout(() => {
    if (
      !isStandalone.value &&
      isMobile.value &&
      !canInstall.value &&
      !getDeferredPrompt()
    ) {
      infoMessage.value = isIOS.value
        ? "On iOS, use Share → Add to Home Screen."
        : "Install not available yet in this browser. Try again later.";
    }
  }, 1500);
});

onBeforeUnmount(() => {
  if (isMobile.value) {
    window.removeEventListener("pwa:can-install", handleCanInstall);
    window.removeEventListener("appinstalled", handleAppInstalled);
  }
});
</script>

<template>
  <div>
    <v-alert
      v-if="isStandalone"
      type="success"
      variant="tonal"
      density="comfortable"
      >App is installed</v-alert
    >
    <div v-else>
      <div v-if="isMobile" class="d-flex align-center" style="gap: 8px">
        <v-btn color="primary" @click="install">Install App</v-btn>
        <span
          v-if="!canInstall && infoMessage"
          class="text-caption text-medium-emphasis"
          >{{ infoMessage }}</span
        >
      </div>
      <!-- Desktop: no CTA or guidance per requirement -->
    </div>
  </div>
</template>
