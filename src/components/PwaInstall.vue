<script setup>
import { ref, onMounted } from "vue";
import PwaInstallModal from "@/components/PwaInstallModal.vue";

const isStandalone = ref(false);
const showModal = ref(false);

onMounted(() => {
  const mq = window.matchMedia("(display-mode: standalone)");
  isStandalone.value = mq.matches || window.navigator.standalone === true;
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
      <div class="d-flex align-center" style="gap: 8px">
        <v-btn color="primary" @click="showModal = true">Install App</v-btn>
      </div>
      <PwaInstallModal v-model="showModal" />
    </div>
  </div>
</template>
