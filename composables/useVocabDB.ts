import Dexie, { type Table } from 'dexie'
import frequencyData from '~/data/frequency.json'

export interface VocabWord {
  lemma: string
  forms_seen: string[]
  freq_rank: number
  cefr: string
  total_exposures: number
  total_clicks: number
  since_last_click: number
  status: 'active' | 'inactive' | 'pool'
}

class VocabDatabase extends Dexie {
  words!: Table<VocabWord, string>

  constructor() {
    super('vocab_reader_db')
    this.version(1).stores({
      words: 'lemma, status, freq_rank'
    })
  }
}

const db = new VocabDatabase()
const INACTIVITY_THRESHOLD = 5
const ACTIVE_TARGET = 50

export function useVocabDB() {
  // Creates a new record for a word discovered for the first time (enters pool)
  async function discoverWord(lemma: string, form: string) {
    const existing = await db.words.get(lemma)
    if (existing) {
      if (!existing.forms_seen.includes(form)) {
        existing.forms_seen.push(form)
        await db.words.put(existing)
      }
      return existing
    }
    const meta = (frequencyData as Record<string, { rank: number; cefr: string }>)[lemma]
    if (!meta) return null // not in our known frequency list yet

    const word: VocabWord = {
      lemma,
      forms_seen: [form],
      freq_rank: meta.rank,
      cefr: meta.cefr,
      total_exposures: 0,
      total_clicks: 0,
      since_last_click: 0,
      status: 'pool'
    }
    await db.words.put(word)
    return word
  }

  // Registers an actual appearance of a word (found by scanning the AI reply text)
  async function registerExposure(lemma: string) {
    const word = await db.words.get(lemma)
    if (!word) return
    word.total_exposures += 1
    word.since_last_click += 1
    if (word.since_last_click >= INACTIVITY_THRESHOLD && word.status === 'active') {
      word.status = 'inactive'
    }
    await db.words.put(word)
  }

  // Registers a user click on a word
  async function registerClick(lemma: string) {
    const word = await db.words.get(lemma)
    if (!word) return
    word.total_clicks += 1
    word.since_last_click = 0
    word.status = 'active'
    await db.words.put(word)
  }

  // Selects the top N active words to send to the AI, ranked by frequency,
  // topped up from the pool if there are not enough active words yet
  async function getTopActiveWords(limit = ACTIVE_TARGET): Promise<VocabWord[]> {
    const active = await db.words.where('status').equals('active').sortBy('freq_rank')
    if (active.length >= limit) return active.slice(0, limit)

    const pool = await db.words.where('status').equals('pool').sortBy('freq_rank')
    const filler = pool.slice(0, limit - active.length)
    return [...active, ...filler]
  }

  async function getAllWords() {
    return db.words.toArray()
  }

  async function getStats() {
    const all = await db.words.toArray()
    return {
      active: all.filter(w => w.status === 'active').length,
      inactive: all.filter(w => w.status === 'inactive').length,
      pool: all.filter(w => w.status === 'pool').length,
      total: all.length
    }
  }

  // One-time demo data so every feature can be tried before an API key is
  // entered. Only runs if the local database is still empty.
  async function seedDemo() {
    const count = await db.words.count()
    if (count > 0) return

    const now = () => ({ total_exposures: 4, total_clicks: 1, since_last_click: 1 })
    const demoWords: VocabWord[] = [
      { lemma: 'resilient', forms_seen: ['resilient'], freq_rank: 1, cefr: 'B2', status: 'active', ...now() },
      { lemma: 'acknowledge', forms_seen: ['acknowledge'], freq_rank: 2, cefr: 'B1', status: 'active', ...now() },
      { lemma: 'facilitate', forms_seen: ['facilitate'], freq_rank: 3, cefr: 'B1', status: 'active', ...now() },
      { lemma: 'substantial', forms_seen: ['substantial'], freq_rank: 4, cefr: 'B1', status: 'active', ...now() },
      { lemma: 'credible', forms_seen: ['credible'], freq_rank: 5, cefr: 'B1', status: 'active', ...now() },
      { lemma: 'marine', forms_seen: ['marine'], freq_rank: 6, cefr: 'B1', status: 'pool', total_exposures: 0, total_clicks: 0, since_last_click: 0 },
      { lemma: 'momentum', forms_seen: ['momentum'], freq_rank: 7, cefr: 'B2', status: 'pool', total_exposures: 0, total_clicks: 0, since_last_click: 0 },
      { lemma: 'notion', forms_seen: ['notion'], freq_rank: 8, cefr: 'B1', status: 'inactive', total_exposures: 5, total_clicks: 0, since_last_click: 5 },
      { lemma: 'profound', forms_seen: ['profound'], freq_rank: 9, cefr: 'B1', status: 'inactive', total_exposures: 6, total_clicks: 1, since_last_click: 5 }
    ]
    await db.words.bulkPut(demoWords)
  }

  async function exportData() {    const all = await db.words.toArray()
    return JSON.stringify({ exported_at: new Date().toISOString(), words: all }, null, 2)
  }

  async function importData(json: string) {
    const parsed = JSON.parse(json)
    const incoming: VocabWord[] = parsed.words || []
    for (const w of incoming) {
      const existing = await db.words.get(w.lemma)
      if (!existing) {
        await db.words.put(w)
      } else {
        // Merge: take the max cumulative values instead of overwriting,
        // to avoid losing progress made on another device
        existing.total_exposures = Math.max(existing.total_exposures, w.total_exposures)
        existing.total_clicks = Math.max(existing.total_clicks, w.total_clicks)
        existing.since_last_click = Math.min(existing.since_last_click, w.since_last_click)
        existing.status = existing.total_clicks >= w.total_clicks ? existing.status : w.status
        await db.words.put(existing)
      }
    }
  }

  return {
    discoverWord,
    registerExposure,
    registerClick,
    getTopActiveWords,
    getAllWords,
    getStats,
    exportData,
    importData,
    seedDemo
  }
}
