import twttr from 'twitter-text'

export const LIMIT = 280

export function weighted(text: string) {
  const p = twttr.parseTweet(text)
  // validRangeEnd is inclusive, in UTF-16 code units
  return { length: p.weightedLength, overflowAt: p.weightedLength > LIMIT ? p.validRangeEnd + 1 : -1 }
}

export type Segment = { text: string; kind: 'plain' | 'entity' | 'over' }

// Splits text into colored segments: entities (links, @, #, $) in blue, overflow past 280 in red
export function segments(text: string): Segment[] {
  const { overflowAt } = weighted(text)
  const entities = twttr.extractEntitiesWithIndices(text)
  const kinds: Segment['kind'][] = new Array(text.length).fill('plain')
  for (const e of entities) for (let i = e.indices[0]; i < e.indices[1]; i++) kinds[i] = 'entity'
  if (overflowAt >= 0) for (let i = overflowAt; i < text.length; i++) kinds[i] = 'over'

  const out: Segment[] = []
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1]
    if (last && last.kind === kinds[i]) last.text += text[i]
    else out.push({ text: text[i], kind: kinds[i] })
  }
  return out
}

const fits = (s: string) => twttr.parseTweet(s).weightedLength <= LIMIT

// Greedily packs text into posts ≤ 280, breaking at paragraphs, then sentences, then words.
export function splitIntoThread(text: string): string[] {
  // Each unit remembers whether a paragraph break follows it, so packing can keep blank lines.
  const units: { text: string; paraEnd: boolean }[] = []
  const push = (t: string) => units.push({ text: t, paraEnd: false })

  for (const para of text.split(/\n\s*\n/)) {
    const p = para.trim()
    if (!p) continue
    if (fits(p)) push(p)
    else {
      const sentences = p.match(/[^.!?…\n]+(?:[.!?…]+["')\]]*)?\s*|\n/g) ?? [p]
      for (const s of sentences) {
        const t = s.trim()
        if (!t) continue
        if (fits(t)) {
          push(t)
          continue
        }
        let cur = ''
        for (const w of t.split(/\s+/)) {
          const next = cur ? `${cur} ${w}` : w
          if (fits(next)) cur = next
          else {
            if (cur) push(cur)
            cur = w
          }
        }
        if (cur) push(cur)
      }
    }
    units[units.length - 1].paraEnd = true
  }

  const posts: string[] = []
  let cur = ''
  let prevParaEnd = false
  for (const u of units) {
    const next = cur ? cur + (prevParaEnd ? '\n\n' : ' ') + u.text : u.text
    if (cur && !fits(next)) {
      posts.push(cur)
      cur = u.text
    } else cur = next
    prevParaEnd = u.paraEnd
  }
  if (cur) posts.push(cur)
  return posts.length ? posts : ['']
}

export function intentUrl(text: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}

export function relativeTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
