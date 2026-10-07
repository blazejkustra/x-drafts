import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Draft } from '../lib/store'
import { copyImage, downloadImage, fitMedia, isVideo, mediaFiles, persistStorage, prepareImage, putImage } from '../lib/media'
import { intentUrl, LIMIT, relativeTime, splitIntoThread, weighted } from '../lib/text'
import { EmojiPicker } from './EmojiPicker'
import { IconBack, IconCheck, IconCircleCheck, IconCopy, IconPlus, IconTrash, XLogo } from './Icons'
import { Post } from './Post'

type Props = {
  draft: Draft
  avatar: string | null
  theme: 'light' | 'dark'
  onUpdate: (id: string, fn: (d: Draft) => Draft) => void
  onDelete: (id: string) => void
  onBack: () => void
  onAvatar: () => void
}

type FocusReq = { index: number; pos: number | 'end' } | null
type Item = { text: string; media: string[] }

const toItems = (d: Draft): Item[] => d.posts.map((text, i) => ({ text, media: d.media[i] ?? [] }))

export function Composer({ draft, avatar, theme, onUpdate, onDelete, onBack, onAvatar }: Props) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [focusReq, setFocusReq] = useState<FocusReq>({ index: 0, pos: 'end' })
  const [emoji, setEmoji] = useState<{ index: number; top: number; left: number } | null>(null)
  const sel = useRef<{ index: number; start: number; end: number }>({ index: 0, start: 0, end: 0 })
  const [copied, setCopied] = useState<Set<number>>(new Set())
  const [copiedAll, setCopiedAll] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lastEmojiClose = useRef(0)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)
  const flash = useCallback((msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500)
  }, [])

  // Reset transient UI when switching drafts
  useEffect(() => {
    setCopied(new Set())
    setConfirmDelete(false)
    setEmoji(null)
    setFocusReq({ index: 0, pos: 'end' })
  }, [draft.id])

  useLayoutEffect(() => {
    if (!focusReq) return
    const el = refs.current[focusReq.index]
    if (!el) return
    el.focus({ preventScroll: false })
    const pos = focusReq.pos === 'end' ? el.value.length : focusReq.pos
    el.setSelectionRange(pos, pos)
    setFocusReq(null)
  }, [focusReq, draft.posts.length])

  const setItems = useCallback(
    (fn: (items: Item[]) => Item[]) => {
      onUpdate(draftRef.current.id, (d) => {
        const next = fn(toItems(d))
        return { ...d, posts: next.map((x) => x.text), media: next.map((x) => x.media), updatedAt: Date.now() }
      })
    },
    [onUpdate],
  )

  const onChange = useCallback(
    (i: number, text: string) => {
      setItems((xs) => xs.map((x, j) => (j === i ? { ...x, text } : x)))
      setCopied((c) => {
        if (!c.has(i)) return c
        const n = new Set(c)
        n.delete(i)
        return n
      })
    },
    [setItems],
  )

  const addBelow = useCallback(
    (i: number) => {
      setItems((xs) => [...xs.slice(0, i + 1), { text: '', media: [] }, ...xs.slice(i + 1)])
      setCopied(new Set())
      setFocusReq({ index: i + 1, pos: 0 })
    },
    [setItems],
  )

  const remove = useCallback(
    (i: number) => {
      setItems((xs) => (xs.length === 1 ? [{ text: '', media: [] }] : xs.filter((_, j) => j !== i)))
      setCopied(new Set())
      setFocusReq({ index: Math.max(0, i - 1), pos: 'end' })
    },
    [setItems],
  )

  const move = useCallback(
    (i: number, dir: -1 | 1) => {
      const j = i + dir
      setItems((xs) => {
        if (j < 0 || j >= xs.length) return xs
        const n = [...xs]
        ;[n[i], n[j]] = [n[j], n[i]]
        return n
      })
      setCopied(new Set())
      setFocusReq({ index: j, pos: 'end' })
    },
    [setItems],
  )

  const split = useCallback(
    (i: number) => {
      const parts = splitIntoThread(draftRef.current.posts[i])
      // Images stay on the first post of the split
      setItems((xs) => [
        ...xs.slice(0, i),
        ...parts.map((text, k) => ({ text, media: k === 0 ? xs[i].media : [] })),
        ...xs.slice(i + 1),
      ])
      setCopied(new Set())
      setFocusReq({ index: i + parts.length - 1, pos: 'end' })
    },
    [setItems],
  )

  const copy = useCallback(async (i: number) => {
    try {
      await navigator.clipboard.writeText(draftRef.current.posts[i])
      setCopied((c) => new Set(c).add(i))
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  const addMedia = useCallback(
    async (i: number, files: File[]) => {
      const { take, note } = fitMedia(draftRef.current.media[i] ?? [], files)
      if (note) flash(note)
      if (!take.length) return
      persistStorage()
      try {
        const ids = await Promise.all(take.map(async (f) => putImage(await prepareImage(f))))
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, media: [...x.media, ...ids] } : x)))
      } catch {
        flash('Couldn’t save that file, browser storage may be full.')
      }
    },
    [setItems, flash],
  )

  // Image ids are left in IndexedDB; App garbage-collects unreferenced ones on load
  const removeMedia = useCallback(
    (i: number, id: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, media: x.media.filter((m) => m !== id) } : x))),
    [setItems],
  )

  const copyMedia = useCallback(async (id: string) => {
    try {
      return await copyImage(id)
    } catch {
      return false
    }
  }, [])

  const downloadMedia = useCallback((i: number, id: string) => {
    const k = draftRef.current.media[i].indexOf(id)
    downloadImage(id, `post-${i + 1}-${isVideo(id) ? 'video' : 'image'}-${k + 1}`)
  }, [])

  const onPaste = useCallback(
    (i: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = mediaFiles(e.clipboardData.files)
      if (!files.length) return
      e.preventDefault()
      addMedia(i, files)
    },
    [addMedia],
  )

  const open = useCallback((i: number) => {
    window.open(intentUrl(draftRef.current.posts[i]), '_blank', 'noopener')
  }, [])

  const setRef = useCallback((i: number, el: HTMLTextAreaElement | null) => {
    refs.current[i] = el
  }, [])

  const onFocus = useCallback((i: number) => {
    sel.current.index = i
  }, [])

  const onKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget
      sel.current = { index: i, start: el.selectionStart, end: el.selectionEnd }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        addBelow(i)
      } else if (e.key === 'Backspace' && i > 0 && el.value === '') {
        e.preventDefault()
        remove(i)
      } else if (e.key === 'ArrowUp' && i > 0 && el.selectionStart === 0 && el.selectionEnd === 0) {
        e.preventDefault()
        setFocusReq({ index: i - 1, pos: 'end' })
      } else if (e.key === 'ArrowDown' && i < draftRef.current.posts.length - 1 && el.selectionStart === el.value.length) {
        e.preventDefault()
        setFocusReq({ index: i + 1, pos: 0 })
      }
    },
    [addBelow, remove],
  )

  const openEmoji = useCallback((i: number, anchor: HTMLElement) => {
    if (Date.now() - lastEmojiClose.current < 150) return
    const el = refs.current[i]
    if (el && document.activeElement === el) sel.current = { index: i, start: el.selectionStart, end: el.selectionEnd }
    else if (sel.current.index !== i && el) sel.current = { index: i, start: el.value.length, end: el.value.length }
    const r = anchor.getBoundingClientRect()
    const width = 352
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12))
    const below = window.innerHeight - r.bottom > 440
    setEmoji({ index: i, left, top: below ? r.bottom + 6 : Math.max(12, r.top - 441) })
  }, [])

  const insertEmoji = (native: string) => {
    const { index, start, end } = sel.current
    const text = draftRef.current.posts[index] ?? ''
    const next = text.slice(0, start) + native + text.slice(end)
    onChange(index, next)
    const pos = start + native.length
    sel.current = { index, start: pos, end: pos }
  }

  const closeEmoji = () => {
    lastEmojiClose.current = Date.now()
    const { index, start } = sel.current
    setEmoji(null)
    setFocusReq({ index, pos: start })
  }

  const filled = draft.posts.filter((p) => p.trim())
  const hasContent = filled.length > 0 || draft.media.some((m) => m.length)
  const allMedia = draft.media.flat()
  const imageCount = allMedia.filter((id) => !isVideo(id)).length
  const videoCount = allMedia.length - imageCount
  const isThread = draft.posts.length > 1
  const overLimit = draft.posts.some((p) => weighted(p).length > LIMIT)
  const total = draft.posts.reduce((n, p) => n + weighted(p).length, 0)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(filled.join('\n\n'))
    } catch {
      return
    }
    setCopiedAll(true)
    window.setTimeout(() => setCopiedAll(false), 1400)
  }

  return (
    <div className="composer">
      <header className="composer-bar">
        <div className="bar-left">
          <button className="icon-btn mobile-only" onClick={onBack} title="All drafts">
            <IconBack />
          </button>
          <span className="meta">
            {isThread ? `Thread · ${draft.posts.length} posts` : 'Post'} · edited {relativeTime(draft.updatedAt)}
          </span>
        </div>
        <div className="bar-right">
          {confirmDelete ? (
            <span className="confirm">
              Delete?
              <button className="text-btn danger" onClick={() => onDelete(draft.id)}>Yes</button>
              <button className="text-btn" onClick={() => setConfirmDelete(false)}>No</button>
            </span>
          ) : (
            <button className="icon-btn" title="Delete draft" onClick={() => setConfirmDelete(true)}>
              <IconTrash size={18} />
            </button>
          )}
          <button
            className={`chip ${draft.posted ? 'on' : ''}`}
            title={draft.posted ? 'Move back to drafts' : 'Mark as posted'}
            onClick={() => onUpdate(draft.id, (d) => ({ ...d, posted: !d.posted }))}
          >
            <IconCircleCheck size={16} /> {draft.posted ? 'Posted' : 'Mark posted'}
          </button>
        </div>
      </header>

      <div className="composer-scroll">
        <div className="sheet">
          {draft.posts.map((text, i) => (
            <Post
              key={i}
              index={i}
              total={draft.posts.length}
              text={text}
              media={draft.media[i] ?? []}
              avatar={avatar}
              copied={copied.has(i)}
              onChange={onChange}
              onFocus={onFocus}
              onKeyDown={onKeyDown}
              onRemove={remove}
              onMove={move}
              onSplit={split}
              onCopy={copy}
              onOpen={open}
              onEmoji={openEmoji}
              onAddMedia={addMedia}
              onRemoveMedia={removeMedia}
              onCopyMedia={copyMedia}
              onDownloadMedia={downloadMedia}
              onPaste={onPaste}
              onAvatar={onAvatar}
              textareaRef={setRef}
            />
          ))}

          <div className="sheet-foot">
            <button className="add-post" onClick={() => addBelow(draft.posts.length - 1)} title="Add post (⌘↵)">
              <span className="add-circle"><IconPlus size={16} /></span>
              Add to thread
            </button>
            <div className="foot-right">
              {isThread && (
                <button className="ghost-btn" disabled={!filled.length} onClick={copyAll}>
                  {copiedAll ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  {copiedAll ? 'Copied' : 'Copy all'}
                </button>
              )}
              <button
                className="post-btn"
                disabled={!hasContent || overLimit}
                title={isThread ? 'Opens X with the first post. Add the rest with the copy buttons.' : 'Open in X'}
                onClick={() => open(0)}
              >
                <XLogo size={14} /> {isThread ? 'Start on X' : 'Post on X'}
              </button>
            </div>
          </div>
          {notice && <p className="notice">{notice}</p>}
          {(isThread || allMedia.length > 0) && (
            <p className="hint">
              {isThread && <>X only accepts one post per link: “Start on X” opens post 1, then copy each next post into the thread. {total} chars total. </>}
              {imageCount > 0 && <>Images can’t travel through the link: hover an image and copy it, then paste it into X. </>}
              {videoCount > 0 && <>Videos can’t be copied to the clipboard: download them, then drop the file into X.</>}
            </p>
          )}
        </div>
        <p className="shortcuts">
          <kbd>⌘</kbd><kbd>↵</kbd> new post · paste or drop images &amp; video · <kbd>⌫</kbd> on empty post removes it · <kbd>N</kbd> new draft · <kbd>/</kbd> search
        </p>
      </div>

      {emoji && (
        <div className="emoji-layer" style={{ top: emoji.top, left: emoji.left }}>
          <EmojiPicker theme={theme} onPick={insertEmoji} onClose={closeEmoji} />
        </div>
      )}
    </div>
  )
}
