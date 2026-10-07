import { useCallback, useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { Sidebar } from './components/Sidebar'
import { blobToDataUrl, collectGarbage, dataUrlToBlob, getImage, putImage } from './lib/media'
import { isEmpty, newDraft, parseBackup, useStore, type Draft } from './lib/store'

const ACTIVE_KEY = 'xdrafts:active'

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

async function resizeImage(file: File, size = 96): Promise<string> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bmp.width, bmp.height)
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export default function App() {
  const { drafts, settings, setDrafts, setSettings, saveError } = useStore()
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY)
    } catch {
      return null
    }
  })
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('editor')
  const searchRef = useRef<HTMLInputElement>(null)
  const systemDark = useSystemDark()
  const theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }, [theme])

  const active = drafts.find((d) => d.id === activeId) ?? null

  // Always have a draft open
  useEffect(() => {
    if (active) return
    const latest = [...drafts].filter((d) => !d.posted).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (latest) setActiveId(latest.id)
    else {
      const d = newDraft()
      setDrafts((ds) => [d, ...ds])
      setActiveId(d.id)
    }
  }, [active, drafts, setDrafts])

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    } catch {
      /* ignore */
    }
  }, [activeId])

  // Selecting another draft drops the one you leave if it's empty
  const select = useCallback(
    (id: string) => {
      setDrafts((ds) => ds.filter((d) => d.id === id || d.id !== activeId || !isEmpty(d)))
      setActiveId(id)
      setMobileView('editor')
    },
    [activeId, setDrafts],
  )

  const create = useCallback(() => {
    if (active && isEmpty(active)) {
      setMobileView('editor')
      return
    }
    const d = newDraft()
    setDrafts((ds) => [d, ...ds])
    setActiveId(d.id)
    setMobileView('editor')
  }, [active, setDrafts])

  const update = useCallback((id: string, fn: (d: Draft) => Draft) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? fn(d) : d)))
  }, [setDrafts])

  const remove = useCallback(
    (id: string) => {
      setDrafts((ds) => ds.filter((d) => d.id !== id))
      setActiveId(null)
    },
    [setDrafts],
  )

  // Drop images no draft references any more (removed images, deleted drafts). Runs once per load.
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        await collectGarbage(new Set(draftsRef.current.flatMap((d) => d.media.flat())))
      } catch {
        /* IndexedDB unavailable */
      }
    }, 2000)
    return () => window.clearTimeout(t)
  }, [])

  const exportData = async () => {
    const images: Record<string, string> = {}
    for (const id of new Set(drafts.flatMap((d) => d.media.flat()))) {
      const blob = await getImage(id).catch(() => undefined)
      if (blob) images[id] = await blobToDataUrl(blob)
    }
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), drafts, images }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `x-drafts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async () => {
    const file = await pickFile('application/json,.json')
    if (!file) return
    try {
      const { drafts: incoming, images } = parseBackup(await file.text())
      for (const [id, url] of Object.entries(images)) await putImage(await dataUrlToBlob(url), id)
      // Merge by id, keeping whichever copy was edited last
      setDrafts((ds) => {
        const map = new Map(ds.map((d) => [d.id, d]))
        for (const d of incoming) {
          const cur = map.get(d.id)
          if (!cur || d.updatedAt > cur.updatedAt) map.set(d.id, d)
        }
        return [...map.values()]
      })
    } catch (e) {
      window.alert(`Couldn’t import: ${(e as Error).message}`)
    }
  }

  const changeAvatar = async () => {
    const file = await pickFile('image/*')
    if (file) setSettings({ avatar: await resizeImage(file) })
  }

  // Global shortcuts: N = new draft, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable], em-emoji-picker') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        create()
      } else if (e.key === '/') {
        e.preventDefault()
        setMobileView('list')
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [create])

  return (
    <div className={`app view-${mobileView}`}>
      <Sidebar
        ref={searchRef}
        drafts={drafts}
        activeId={activeId}
        settings={settings}
        saveError={saveError}
        onSelect={select}
        onNew={create}
        onTheme={(t) => setSettings({ theme: t })}
        onExport={exportData}
        onImport={importData}
      />
      <main className="main">
        {active && (
          <Composer
            draft={active}
            avatar={settings.avatar}
            theme={theme}
            onUpdate={update}
            onDelete={remove}
            onBack={() => setMobileView('list')}
            onAvatar={changeAvatar}
          />
        )}
      </main>
    </div>
  )
}
