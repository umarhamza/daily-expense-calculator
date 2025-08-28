<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import PwaInstallModal from "@/components/PwaInstallModal.vue";

const isStandalone = ref(false);
const showModal = ref(false);

onMounted(() => {
  const mq = window.matchMedia("(display-mode: standalone)");
  const updateStandalone = () => {
    isStandalone.value = mq.matches || window.navigator.standalone === true;
  };
  updateStandalone();
  try {
    mq.addEventListener("change", updateStandalone);
  } catch (_) {
    // Safari < 14 fallback
    mq.addListener(updateStandalone);
  }

  onUnmounted(() => {
    try {
      mq.removeEventListener("change", updateStandalone);
    } catch (_) {
      mq.removeListener(updateStandalone);
    }
  });
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
      <div class="d-flex align-center">
        <v-btn color="primary" @click="showModal = true">Install App</v-btn>
      </div>
      <PwaInstallModal v-model="showModal" />
    </div>
  </div>
</template>
