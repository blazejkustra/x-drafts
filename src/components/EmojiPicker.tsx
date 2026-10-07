import { useEffect, useRef } from 'react'

type Props = {
  theme: 'light' | 'dark'
  onPick: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ theme, onPick, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const pick = useRef(onPick)
  const close = useRef(onClose)
  pick.current = onPick
  close.current = onClose

  useEffect(() => {
    let cancelled = false
    let el: HTMLElement | null = null
    Promise.all([import('emoji-mart'), import('@emoji-mart/data')]).then(([{ Picker }, data]) => {
      if (cancelled || !host.current) return
      el = new Picker({
        data: data.default,
        theme,
        autoFocus: true,
        previewPosition: 'none',
        skinTonePosition: 'search',
        maxFrequentRows: 2,
        onEmojiSelect: (e: { native: string }) => pick.current(e.native),
        onClickOutside: () => close.current(),
      }) as unknown as HTMLElement
      host.current.appendChild(el)
    })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      el?.remove()
      window.removeEventListener('keydown', onKey)
    }
  }, [theme])

  return <div className="emoji-pop" ref={host} onMouseDown={(e) => e.stopPropagation()} />
}
