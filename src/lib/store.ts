import { useCallback, useEffect, useRef, useState } from 'react'

export type Draft = {
  id: string
  posts: string[]
  /** Image ids (IndexedDB) per post, same length as posts */
  media: string[][]
  posted: boolean
  createdAt: number
  updatedAt: number
}

export type Settings = {
  avatar: string | null
  theme: 'system' | 'light' | 'dark'
}

type Data = { version: 1; drafts: Draft[]; settings: Settings }

const KEY = 'xdrafts:v1'
const DEFAULT_SETTINGS: Settings = { avatar: null, theme: 'system' }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const newDraft = (): Draft => {
  const now = Date.now()
  return { id: uid(), posts: [''], media: [[]], posted: false, createdAt: now, updatedAt: now }
}

export const isEmpty = (d: Draft) => d.posts.every((p) => p.trim() === '') && d.media.every((m) => m.length === 0)

// Older saves had no media; keep media aligned with posts
export const normalize = (d: Draft): Draft => ({
  ...d,
  media: d.posts.map((_, i) => (Array.isArray(d.media?.[i]) ? d.media[i].map(String) : [])),
})

function load(): Data {
  const data = read()
  if (!data.drafts.length) data.drafts = [newDraft()]
  return data
}

function read(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Data
      return { version: 1, drafts: (parsed.drafts ?? []).map(normalize), settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return { version: 1, drafts: [], settings: DEFAULT_SETTINGS }
}

export function parseBackup(json: string): { drafts: Draft[]; images: Record<string, string> } {
  const parsed = JSON.parse(json)
  const images: Record<string, string> = parsed && typeof parsed.images === 'object' ? parsed.images : {}
  const drafts: unknown = Array.isArray(parsed) ? parsed : parsed?.drafts
  if (!Array.isArray(drafts)) throw new Error('No drafts found in file')
  const list = drafts
    .filter((d) => d && Array.isArray(d.posts))
    .map((d) =>
      normalize({
        id: typeof d.id === 'string' ? d.id : uid(),
        posts: d.posts.map(String),
        media: d.media,
        posted: Boolean(d.posted),
        createdAt: Number(d.createdAt) || Date.now(),
        updatedAt: Number(d.updatedAt) || Date.now(),
      }),
    )
  return { drafts: list, images }
}

export function useStore() {
  const [data, setData] = useState<Data>(load)
  const timer = useRef<number | undefined>(undefined)
  const [saveError, setSaveError] = useState(false)

  // Debounced persist
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data))
        setSaveError(false)
      } catch {
        setSaveError(true)
      }
    }, 250)
  }, [data])

  // Flush on tab close
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [data])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setData(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setDrafts = useCallback((fn: (d: Draft[]) => Draft[]) => setData((s) => ({ ...s, drafts: fn(s.drafts) })), [])
  const setSettings = useCallback(
    (patch: Partial<Settings>) => setData((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [],
  )

  return { drafts: data.drafts, settings: data.settings, setDrafts, setSettings, saveError }
}
