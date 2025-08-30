<script setup>
import { ref, watch, nextTick, onMounted, computed } from "vue";
import { supabase } from "@/lib/supabase";
import { showErrorToast } from "@/lib/toast";
import { useSpeechToText } from "@/lib/useSpeechToText";
import { listChats, listMessages } from "@/lib/supabase";
import MessageList from "./chat/MessageList.vue";
import Composer from "./chat/Composer.vue";

const emit = defineEmits(["added"]);

const messages = ref([
  { role: "assistant", content: "Ask me about your spend." },
]);
const input = ref("");
const isSending = ref(false);
const errorMessage = ref("");
const pendingProposal = ref(null);
const pendingAssistantIndex = ref(-1);

const chatId = ref(null);
const chats = ref([]);
const isLoadingChats = ref(false);
const isLoadingMessages = ref(false);
const chatOptions = computed(() => (chats.value || []).map(c => ({ id: c.id, title: c.title || 'Untitled' })));

// Voice to text
const {
  isSupported: isSttSupported,
  isListening,
  transcript,
  errorMessage: sttError,
  start: startStt,
  stop: stopStt,
} = useSpeechToText();

watch(transcript, (t) => {
  if (t && typeof t === "string") {
    input.value = t;
  }
});

watch(sttError, (e) => {
  if (e) {
    showErrorToast(e);
  }
});

function buildHistoryPayload() {
  const cleaned = messages.value
    .filter((m) => m && m.content && m.content !== "Thinking…")
    .map((m) => ({ role: m.role, content: m.content }));
  return cleaned.slice(-20);
}

function resetChat() {
  messages.value = [{ role: "assistant", content: "Ask me about your spend." }];
  input.value = "";
  errorMessage.value = "";
  pendingProposal.value = null;
  pendingAssistantIndex.value = -1;
  chatId.value = null;
}

async function sendMessage() {
  const q = input.value.trim();
  if (!q || isSending.value) return;
  try {
    if (isListening.value) stopStt();
  } catch (_) {}
  messages.value.push({ role: "user", content: q });
  input.value = "";
  errorMessage.value = "";
  isSending.value = true;

  const pendingIndex =
    messages.value.push({ role: "assistant", content: "Thinking…" }) - 1;
  pendingAssistantIndex.value = pendingIndex;

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question: q, history: buildHistoryPayload(), chatId: chatId.value, title: chatId.value ? undefined : q.slice(0, 60) }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to get answer");

    if (json.confirmationRequired && json.proposal) {
      pendingProposal.value = json.proposal;
      messages.value[pendingIndex] = {
        role: "assistant",
        content: json.answer,
      };
      return;
    }

    if (
      json.added &&
      Array.isArray(json.added.items) &&
      json.added.items.length
    ) {
      emit("added", json.added);
      messages.value[pendingIndex] = {
        role: "assistant",
        content: json.answer,
      };
      return;
    }

    if (json.attemptedAdd) {
      messages.value[pendingIndex] = {
        role: "assistant",
        content:
          "I couldn’t understand the items. Try: “add bread 3 at 12 each, eggs 2 at 15 each”.",
      };
      return;
    }

    messages.value[pendingIndex] = { role: "assistant", content: json.answer };
    if (json.chatId && !chatId.value) chatId.value = json.chatId;
    try { if (chatId.value) await loadMessages(chatId.value); } catch (_) {}
    return;
  } catch (err) {
    messages.value[pendingIndex] = {
      role: "assistant",
      content: "Sorry, I had trouble answering that.",
    };
    errorMessage.value = err?.message || "Something went wrong";
  } finally {
    isSending.value = false;
  }
}

async function confirmProposal() {
  if (!pendingProposal.value || isSending.value) return;
  isSending.value = true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: "confirm",
        history: buildHistoryPayload(),
        chatId: chatId.value,
        confirm: {
          type: pendingProposal.value.type,
          payload: pendingProposal.value,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to confirm");
    if (pendingAssistantIndex.value >= 0) {
      messages.value[pendingAssistantIndex.value] = {
        role: "assistant",
        content: json.answer,
      };
    } else {
      messages.value.push({ role: "assistant", content: json.answer });
    }
    if (
      json.added &&
      Array.isArray(json.added.items) &&
      json.added.items.length
    )
      emit("added", json.added);
    if (json.chatId && !chatId.value) chatId.value = json.chatId;
    try { if (chatId.value) await loadMessages(chatId.value); } catch (_) {}
    pendingProposal.value = null;
    pendingAssistantIndex.value = -1;
  } catch (err) {
    errorMessage.value = err?.message || "Something went wrong";
  } finally {
    isSending.value = false;
  }
}

function cancelProposal() {
  pendingProposal.value = null;
  if (pendingAssistantIndex.value >= 0) {
    messages.value[pendingAssistantIndex.value] = {
      role: "assistant",
      content: "Okay, cancelled.",
    };
  } else {
    messages.value.push({ role: "assistant", content: "Okay, cancelled." });
  }
  pendingAssistantIndex.value = -1;
}

async function loadChats() {
  try {
    isLoadingChats.value = true;
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;
    const res = await listChats(userId);
    if (!res.error) chats.value = res.data || [];
  } finally {
    isLoadingChats.value = false;
  }
}

async function loadMessages(id) {
  try {
    isLoadingMessages.value = true;
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId || !id) return;
    const res = await listMessages(userId, id, 100);
    if (!res.error) {
      messages.value = (res.data || []).map(m => ({ role: m.role, content: m.content }));
      if (messages.value.length === 0) messages.value = [{ role: "assistant", content: "Ask me about your spend." }];
    }
  } finally {
    isLoadingMessages.value = false;
  }
}

async function selectChat(id) {
  chatId.value = id || null;
  if (chatId.value) {
    await loadMessages(chatId.value);
  } else {
    resetChat();
  }
}

async function deleteCurrentChat() {
  try {
    if (!chatId.value) return;
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;
    const { error } = await (await import("@/lib/supabase")).deleteChat(userId, chatId.value);
    if (!error) {
      chatId.value = null;
      await loadChats();
      resetChat();
    } else {
      showErrorToast(error.message || "Failed to delete chat");
    }
  } catch (e) {
    showErrorToast(e?.message || "Failed to delete chat");
  }
}

onMounted(async () => {
  try { await loadChats(); } catch (_) {}
});
</script>

<template>
  <div class="flex flex-col h-dvh bg-neutral-50 dark:bg-neutral-900">
    <header class="sticky top-0 z-10 border-b bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur">
      <div class="mx-auto max-w-md px-3 h-12 flex items-center justify-between">
        <h1 class="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">Chat</h1>
        <div class="flex items-center gap-2">
          <v-select
            v-model="chatId"
            :items="chatOptions"
            item-title="title"
            item-value="id"
            label="Chats"
            density="compact"
            style="min-width: 160px;"
            :loading="isLoadingChats"
            @update:modelValue="selectChat"
          />
          <v-btn size="small" variant="text" @click="resetChat">New</v-btn>
          <v-btn size="small" variant="text" :disabled="!chatId" @click="deleteCurrentChat">Delete</v-btn>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-md w-full flex-1 min-h-0 flex flex-col">
      <MessageList :messages="messages" :is-loading="isLoadingMessages" :is-streaming="isSending" />
      <div v-if="pendingProposal" class="px-3 pb-2">
        <div class="flex items-center gap-2">
          <v-btn color="primary" :disabled="isSending" @click="confirmProposal">Confirm</v-btn>
          <v-btn variant="text" :disabled="isSending" @click="cancelProposal">Cancel</v-btn>
        </div>
      </div>
      <div v-if="errorMessage" class="px-3 pb-2 text-sm text-red-600">{{ errorMessage }}</div>
      <div v-if="sttError" class="px-3 pb-2 text-xs text-red-600">{{ sttError }}</div>
      <Composer
        :model-value="input"
        :is-sending="isSending"
        :is-listening="isListening"
        :stt-supported="isSttSupported"
        @update:modelValue="(v) => (input = v)"
        @send="sendMessage"
        @stop="() => {}"
        @toggleStt="isListening ? stopStt() : startStt()"
      />
    </main>
  </div>
</template>
