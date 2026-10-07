import { forwardRef, useMemo, useState } from 'react'
import type { Draft, Settings } from '../lib/store'
import { relativeTime } from '../lib/text'
import { IconDownload, IconMonitor, IconMoon, IconPlus, IconSearch, IconSun, IconUpload } from './Icons'

type Props = {
  drafts: Draft[]
  activeId: string | null
  settings: Settings
  saveError: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onTheme: (t: Settings['theme']) => void
  onExport: () => void
  onImport: () => void
}

const preview = (d: Draft) => {
  const first = d.posts.find((p) => p.trim()) ?? ''
  if (first.trim()) return first.trim().split('\n')[0]
  const all = d.media.flat()
  if (all.some((id) => id.startsWith('v_'))) return 'Video post'
  return all.length ? 'Image post' : 'Empty draft'
}

export const Sidebar = forwardRef<HTMLInputElement, Props>(function Sidebar(p, searchRef) {
  const [q, setQ] = useState('')
  const [showPosted, setShowPosted] = useState(false)

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...p.drafts]
      .filter((d) => !needle || d.posts.some((t) => t.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [p.drafts, q])

  const drafts = sorted.filter((d) => !d.posted)
  const posted = sorted.filter((d) => d.posted)

  const item = (d: Draft) => (
    <button key={d.id} className={`item ${d.id === p.activeId ? 'active' : ''}`} onClick={() => p.onSelect(d.id)}>
      <span className={`item-title ${preview(d) === 'Empty draft' ? 'muted' : ''}`}>{preview(d)}</span>
      <span className="item-meta">
        {d.posts.length > 1 && <span className="badge">{d.posts.length} posts</span>}
        {d.media.some((m) => m.length) && <span className="badge">{d.media.flat().some((id) => id.startsWith('v_')) ? 'video' : `${d.media.flat().length} img`}</span>}
        {relativeTime(d.updatedAt)}
      </span>
    </button>
  )

  const themes: { id: Settings['theme']; icon: React.ReactNode; label: string }[] = [
    { id: 'light', icon: <IconSun size={15} />, label: 'Light' },
    { id: 'system', icon: <IconMonitor size={15} />, label: 'System' },
    { id: 'dark', icon: <IconMoon size={15} />, label: 'Dark' },
  ]

  return (
    <aside className="sidebar">
      <div className="side-head">
        <div className="brand">
          <span className="brand-mark">✎</span> Drafts
        </div>
        <button className="icon-btn" title="New draft (N)" onClick={p.onNew}>
          <IconPlus size={18} />
        </button>
      </div>

      <label className="search">
        <IconSearch size={15} />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" onKeyDown={(e) => e.key === 'Escape' && (setQ(''), e.currentTarget.blur())} />
      </label>

      <nav className="list">
        {drafts.map(item)}
        {!drafts.length && <p className="empty">{q ? 'No matches' : 'No drafts yet'}</p>}

        {posted.length > 0 && (
          <>
            <button className="section" onClick={() => setShowPosted((s) => !s)}>
              <span className={`caret ${showPosted || q ? 'open' : ''}`}>›</span> Posted <span className="count">{posted.length}</span>
            </button>
            {(showPosted || q) && posted.map(item)}
          </>
        )}
      </nav>

      <footer className="side-foot">
        {p.saveError && <p className="warn">Storage is full, changes aren’t saving. Export a backup.</p>}
        <div className="seg" role="radiogroup" aria-label="Theme">
          {themes.map((t) => (
            <button key={t.id} role="radio" aria-checked={p.settings.theme === t.id} title={t.label} className={p.settings.theme === t.id ? 'on' : ''} onClick={() => p.onTheme(t.id)}>
              {t.icon}
            </button>
          ))}
        </div>
        <div className="foot-actions">
          <button className="icon-btn" title="Export backup (JSON)" onClick={p.onExport}>
            <IconDownload size={17} />
          </button>
          <button className="icon-btn" title="Import backup" onClick={p.onImport}>
            <IconUpload size={17} />
          </button>
        </div>
      </footer>
      <p className="local-note">Saved in this browser only</p>
    </aside>
  )
})
