import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isVideo, mediaFiles, MAX_MEDIA } from '../lib/media'
import { MediaGrid } from './MediaGrid'
import { LIMIT, segments, weighted } from '../lib/text'
import { IconCheck, IconCopy, IconDown, IconImage, IconSmile, IconSplit, IconUp, IconX, IconSend } from './Icons'

type Props = {
  index: number
  total: number
  text: string
  media: string[]
  avatar: string | null
  copied: boolean
  onChange: (index: number, text: string) => void
  onFocus: (index: number) => void
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onRemove: (index: number) => void
  onMove: (index: number, dir: -1 | 1) => void
  onSplit: (index: number) => void
  onCopy: (index: number) => void
  onOpen: (index: number) => void
  onEmoji: (index: number, anchor: HTMLElement) => void
  onAvatar: () => void
  onAddMedia: (index: number, files: File[]) => void
  onRemoveMedia: (index: number, id: string) => void
  onCopyMedia: (id: string) => Promise<boolean>
  onDownloadMedia: (index: number, id: string) => void
  onPaste: (index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  textareaRef: (index: number, el: HTMLTextAreaElement | null) => void
}

export function Ring({ length }: { length: number }) {
  const remaining = LIMIT - length
  const r = 9
  const c = 2 * Math.PI * r
  const pct = Math.min(length / LIMIT, 1)
  const state = remaining < 0 ? 'over' : remaining <= 20 ? 'warn' : 'ok'
  const big = remaining <= 20
  if (length === 0) return <div className="ring" />
  return (
    <div className={`ring ${state}`} title={`${length} / ${LIMIT}`}>
      {remaining > -10 && (
        <svg width={big ? 30 : 22} height={big ? 30 : 22} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r={r} className="ring-track" />
          <circle
            cx="12"
            cy="12"
            r={r}
            className="ring-fill"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            transform="rotate(-90 12 12)"
          />
        </svg>
      )}
      {big && <span className="ring-num">{remaining}</span>}
    </div>
  )
}

export const Post = memo(function Post(p: Props) {
  const ta = useRef<HTMLTextAreaElement | null>(null)
  const { length, overflowAt } = useMemo(() => weighted(p.text), [p.text])
  const segs = useMemo(() => segments(p.text), [p.text])
  const isThread = p.total > 1
  const isLast = p.index === p.total - 1
  const file = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const full = p.media.length >= MAX_MEDIA || p.media.some(isVideo)

  // Auto-grow
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [p.text])

  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    })
    ro.observe(el.parentElement!)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className={`post ${isLast ? 'last' : ''} ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        setDragging(false)
        const files = mediaFiles(e.dataTransfer.files)
        if (!files.length) return
        e.preventDefault()
        p.onAddMedia(p.index, files)
      }}
    >
      <div className="post-gutter">
        <button className="avatar" onClick={p.onAvatar} title="Change avatar" tabIndex={-1}>
          {p.avatar ? <img src={p.avatar} alt="" /> : <span />}
        </button>
        {!isLast && <div className="thread-line" />}
      </div>

      <div className="post-body">
        <div className="field">
          <div className="highlight" aria-hidden>
            {segs.map((s, i) =>
              s.kind === 'plain' ? s.text : <span key={i} className={`hl-${s.kind}`}>{s.text}</span>,
            )}
            {'​'}
          </div>
          <textarea
            ref={(el) => {
              ta.current = el
              p.textareaRef(p.index, el)
            }}
            value={p.text}
            rows={1}
            spellCheck
            placeholder={p.index === 0 ? "What's happening?" : 'Add another post'}
            onChange={(e) => p.onChange(p.index, e.target.value)}
            onFocus={() => p.onFocus(p.index)}
            onKeyDown={(e) => p.onKeyDown(p.index, e)}
            onPaste={(e) => p.onPaste(p.index, e)}
          />
        </div>

        <MediaGrid
          ids={p.media}
          onRemove={(id) => p.onRemoveMedia(p.index, id)}
          onCopy={p.onCopyMedia}
          onDownload={(id) => p.onDownloadMedia(p.index, id)}
        />

        <div className="post-tools">
          <div className="tools-left">
            <button
              className="tool"
              title={full ? 'Media full: 1 video or 4 images' : 'Add images or a video'}
              disabled={full}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => file.current?.click()}
            >
              <IconImage />
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                p.onAddMedia(p.index, mediaFiles(e.target.files))
                e.target.value = ''
              }}
            />
            <button className="tool" title="Emoji" onMouseDown={(e) => e.preventDefault()} onClick={(e) => p.onEmoji(p.index, e.currentTarget)}>
              <IconSmile />
            </button>
            {overflowAt >= 0 && (
              <button className="tool tool-label" title="Split this post into a thread" onClick={() => p.onSplit(p.index)}>
                <IconSplit size={18} /> Split into thread
              </button>
            )}
          </div>
          <div className="tools-right">
            {isThread && <span className="post-num">{p.index + 1}/{p.total}</span>}
            <Ring length={length} />
            <div className="divider" />
            {isThread && (
              <>
                <button className="tool sm" title="Move up" disabled={p.index === 0} onClick={() => p.onMove(p.index, -1)}>
                  <IconUp size={17} />
                </button>
                <button className="tool sm" title="Move down" disabled={isLast} onClick={() => p.onMove(p.index, 1)}>
                  <IconDown size={17} />
                </button>
              </>
            )}
            <button className={`tool sm ${p.copied ? 'done' : ''}`} title="Copy post" disabled={!p.text.trim()} onClick={() => p.onCopy(p.index)}>
              {p.copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            </button>
            <button className="tool sm" title="Open this post in X" disabled={!p.text.trim()} onClick={() => p.onOpen(p.index)}>
              <IconSend size={17} />
            </button>
            {isThread && (
              <button className="tool sm danger" title="Remove post" onClick={() => p.onRemove(p.index)}>
                <IconX size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
