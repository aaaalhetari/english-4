<script setup lang="ts">
const emit = defineEmits(['start-real'])
const { seedDemo, getStats } = useVocabDB()
const { apiKey } = useApiKey()

const stats = ref({ active: 0, inactive: 0, pool: 0, total: 0 })
const keyInput = ref('')

// Fixed sample "AI reply" so every click/TTS/selection feature works with
// zero API calls. This mirrors exactly what a real reply looks like: plain
// text with vocabulary words the scanning engine would normally detect.
const demoText = `New research suggests that coral reefs can be surprisingly resilient when given enough time to recover. Scientists acknowledge that the process is slow, but improved technology could help facilitate faster restoration in marine environments. The findings offer a substantial and credible reason for optimism among biologists.`

// Simulates the ---MEANINGS--- section a real reply would include, so the
// popup's first lookup layer (context meaning) can be tested directly.
const demoContextMeanings = {
  resilient: 'able to withstand or recover quickly from damage in this specific ecological context'
}

const chunks = ref<string[]>([])
const selectionQuestion = ref('')
const selectionAnswer = ref('')
const selectionLoading = ref(false)
const textRef = ref<any>(null)

async function refreshStats() {
  stats.value = await getStats()
}

// Canned response - no API call, so this works before a key is entered
async function askDemoSelection() {
  const c: string[] = textRef.value?.selectedChunks || []
  if (!c.length || !selectionQuestion.value.trim()) return
  selectionLoading.value = true
  await new Promise(r => setTimeout(r, 500))
  selectionAnswer.value = `(Demo answer — once you add your API key, this becomes a real AI response about: "${c.join('", "')}")`
  selectionLoading.value = false
}

function saveKeyAndStart() {
  const key = keyInput.value.trim()
  apiKey.value = key
  if (key) emit('start-real', key)
}

onMounted(async () => {
  await seedDemo()
  await refreshStats()
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-xs text-amber-700">
      Demo mode — sample data only, no API calls made yet.
    </div>

    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Vocab Reader</h1>
      <div class="text-xs text-slate-500 flex gap-3">
        <span>active: {{ stats.active }}</span>
        <span>dormant: {{ stats.inactive }}</span>
        <span>pool: {{ stats.pool }}</span>
      </div>
    </div>

    <p class="text-xs text-slate-400 mb-2">Sample AI reply — click any underlined word, try selecting a phrase:</p>
    <ClientOnly>
      <ClickableText ref="textRef" :text="demoText" :context-meanings="demoContextMeanings" />
    </ClientOnly>

    <div v-if="textRef?.selectedChunks?.length" class="border border-amber-200 bg-amber-50 rounded-xl p-3 my-6">
      <p class="text-xs text-slate-500 mb-2">Ask about the passages selected above:</p>
      <div class="flex gap-2">
        <input v-model="selectionQuestion" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Your question..." @keyup.enter="askDemoSelection" />
        <button class="bg-amber-500 text-white rounded-lg px-4 text-sm" @click="askDemoSelection">Ask</button>
      </div>
      <p v-if="selectionLoading" class="text-xs text-slate-400 mt-2">Thinking...</p>
      <p v-else-if="selectionAnswer" class="text-sm mt-2">{{ selectionAnswer }}</p>
    </div>

    <div class="mt-10 border-t border-slate-200 pt-5">
      <p class="text-sm font-medium mb-1">Everything working the way you expect?</p>
      <p class="text-xs text-slate-500 mb-3">Add your Anthropic API key to start real conversations and real learning.</p>
      <div class="flex gap-2">
        <input
          v-model="keyInput"
          type="password"
          placeholder="sk-ant-..."
          class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="saveKeyAndStart"
        />
        <button class="bg-emerald-600 text-white rounded-lg px-4 text-sm font-medium disabled:opacity-40" :disabled="!keyInput.trim()" @click="saveKeyAndStart">
          Start learning
        </button>
      </div>
    </div>
  </div>
</template>
