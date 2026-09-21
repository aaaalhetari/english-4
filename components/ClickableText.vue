<script setup lang="ts">
const props = defineProps<{
  text: string
  contextMeanings: Record<string, string>
}>()

const { lemmatize } = useLemmatizer()
const { getAllWords } = useVocabDB()

interface Segment { raw: string; isWord: boolean; lemma?: string; status?: string }
const segments = ref<Segment[]>([])
const popupWord = ref<string | null>(null)

// multi-selection tool
const selectedChunks = ref<string[]>([])
const showAddButton = ref(false)
const selectionRect = ref({ top: 0, left: 0 })

async function buildSegments() {
  const parts = props.text.split(/([A-Za-z']+)/g)
  const allWords = await getAllWords()
  const known = new Map(allWords.map(w => [w.lemma, w.status]))

  segments.value = parts.map(part => {
    if (/^[A-Za-z']+$/.test(part)) {
      const lemma = lemmatize(part.toLowerCase())
      return { raw: part, isWord: true, lemma, status: known.get(lemma) }
    }
    return { raw: part, isWord: false }
  })
}

function openPopup(lemma?: string) {
  if (!lemma) return
  popupWord.value = lemma
}

function handleSelectionChange() {
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (text && text.length > 0 && sel && sel.rangeCount > 0) {
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    selectionRect.value = { top: rect.top + window.scrollY - 40, left: rect.left + window.scrollX }
    showAddButton.value = true
  } else {
    showAddButton.value = false
  }
}

function addCurrentSelectionToChunks() {
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (text) {
    selectedChunks.value.push(text)
    sel?.removeAllRanges()
  }
  showAddButton.value = false
}

function removeChunk(i: number) {
  selectedChunks.value.splice(i, 1)
}

defineExpose({ selectedChunks })

onMounted(() => {
  buildSegments()
  document.addEventListener('selectionchange', handleSelectionChange)
})
onUnmounted(() => document.removeEventListener('selectionchange', handleSelectionChange))
watch(() => props.text, buildSegments)
</script>

<template>
  <div class="relative leading-8 text-[15px] select-text">
    <span
      v-for="(seg, i) in segments"
      :key="i"
      :class="seg.isWord && seg.status === 'active' ? 'word-active' : seg.isWord && seg.status === 'pool' ? 'word-pool' : ''"
      @click="seg.isWord && seg.status ? openPopup(seg.lemma) : null"
    >{{ seg.raw }}</span>

    <button
      v-if="showAddButton"
      class="fixed z-40 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg"
      :style="{ top: selectionRect.top + 'px', left: selectionRect.left + 'px' }"
      @click="addCurrentSelectionToChunks"
    >
      + Add to selection
    </button>

    <div v-if="selectedChunks.length" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="(c, i) in selectedChunks"
        :key="i"
        class="selection-marked text-xs px-2 py-1 flex items-center gap-1"
      >
        "{{ c.slice(0, 30) }}{{ c.length > 30 ? '…' : '' }}"
        <button class="text-amber-700 font-bold" @click="removeChunk(i)">×</button>
      </span>
    </div>

    <WordPopup
      v-if="popupWord"
      :word="popupWord"
      :context-meanings="contextMeanings"
      :context-sentence="text"
      @close="popupWord = null"
    />
  </div>
</template>
