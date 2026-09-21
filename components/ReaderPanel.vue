<script setup lang="ts">
import type { ChatTurn } from '~/composables/useClaude'

const { ask, askAboutSelection } = useClaude()
const { tokenize, lemmatize } = useLemmatizer()
const { discoverWord, registerExposure, getTopActiveWords, getStats, exportData, importData } = useVocabDB()

const question = ref('')
const loading = ref(false)
const history = ref<ChatTurn[]>([])
const currentMeanings = ref<Record<string, string>>({})
const stats = ref({ active: 0, inactive: 0, pool: 0, total: 0 })

const textRefs = ref<any[]>([])
const selectionQuestion = ref('')
const selectionAnswer = ref('')
const selectionLoading = ref(false)

async function refreshStats() {
  stats.value = await getStats()
}

// Local scanning engine: reads the actual reply text word by word (no AI call)
async function scanReply(text: string) {
  const tokens = tokenize(text)
  const seenInThisReply = new Set<string>()
  for (const token of tokens) {
    const lemma = lemmatize(token)
    if (seenInThisReply.has(lemma)) continue
    seenInThisReply.add(lemma)
    const word = await discoverWord(lemma, token)
    if (word) await registerExposure(lemma)
  }
  await refreshStats()
}

async function send() {
  if (!question.value.trim() || loading.value) return
  loading.value = true
  const q = question.value
  question.value = ''

  const activeWords = (await getTopActiveWords()).map(w => w.lemma)
  const { text, meanings } = await ask(q, history.value, activeWords)

  history.value.push({ role: 'user', content: q })
  history.value.push({ role: 'assistant', content: text })
  currentMeanings.value = { ...currentMeanings.value, ...meanings }

  await scanReply(text)
  loading.value = false
}

async function askSelection() {
  const lastTextRef = textRefs.value[textRefs.value.length - 1]
  const chunks: string[] = lastTextRef?.selectedChunks || []
  if (!chunks.length || !selectionQuestion.value.trim()) return
  selectionLoading.value = true
  selectionAnswer.value = await askAboutSelection(chunks, selectionQuestion.value)
  selectionLoading.value = false
}

async function handleExport() {
  const json = await exportData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocab_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    await importData(text)
    await refreshStats()
  }
  input.click()
}

onMounted(refreshStats)
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Vocab Reader</h1>
      <div class="text-xs text-slate-500 flex gap-3">
        <span>active: {{ stats.active }}</span>
        <span>dormant: {{ stats.inactive }}</span>
        <span>pool: {{ stats.pool }}</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <button class="text-xs bg-slate-100 rounded-lg px-3 py-1.5" @click="handleExport">⬇ Export vocab data</button>
      <button class="text-xs bg-slate-100 rounded-lg px-3 py-1.5" @click="triggerImport">⬆ Import</button>
    </div>

    <div class="space-y-6 mb-6">
      <div v-for="(turn, i) in history" :key="i">
        <div v-if="turn.role === 'user'" class="text-sm text-slate-500 mb-1">You: {{ turn.content }}</div>
        <ClientOnly v-else>
          <ClickableText
            :ref="(el: any) => textRefs.push(el)"
            :text="turn.content"
            :context-meanings="currentMeanings"
          />
        </ClientOnly>
      </div>
    </div>

    <div v-if="textRefs.length && textRefs[textRefs.length - 1]?.selectedChunks?.length" class="border border-amber-200 bg-amber-50 rounded-xl p-3 mb-6">
      <p class="text-xs text-slate-500 mb-2">Ask about the passages selected above:</p>
      <div class="flex gap-2">
        <input v-model="selectionQuestion" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Your question..." @keyup.enter="askSelection" />
        <button class="bg-amber-500 text-white rounded-lg px-4 text-sm" @click="askSelection">Ask</button>
      </div>
      <p v-if="selectionLoading" class="text-xs text-slate-400 mt-2">Thinking...</p>
      <p v-else-if="selectionAnswer" class="text-sm mt-2">{{ selectionAnswer }}</p>
    </div>

    <div class="flex gap-2 sticky bottom-4">
      <input
        v-model="question"
        class="flex-1 border border-slate-300 rounded-full px-4 py-3 text-sm shadow-sm"
        placeholder="Ask about a news story, topic, or anything..."
        @keyup.enter="send"
      />
      <button class="bg-emerald-600 text-white rounded-full px-5 text-sm font-medium disabled:opacity-40" :disabled="loading" @click="send">
        {{ loading ? '...' : 'Send' }}
      </button>
    </div>
  </div>
</template>
