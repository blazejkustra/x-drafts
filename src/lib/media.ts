import { useEffect, useState } from 'react'

// Images and videos live in IndexedDB (localStorage is ~5MB and strings only). Drafts reference them by id.
// Video ids are prefixed with "v_" so the kind is known without reading the blob.
const DB = 'xdrafts-media'
const STORE = 'images'
export const MAX_MEDIA = 4
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024 // X's upload limit
export const isVideo = (id: string) => id.startsWith('v_')
export const isVideoFile = (f: File) => f.type.startsWith('video/')

// X rules: either one video, or up to 4 images. Returns which incoming files fit and why others didn't.
export function fitMedia(existing: string[], files: File[]): { take: File[]; note: string | null } {
  if (existing.some(isVideo)) return { take: [], note: 'A post with a video can’t have more media.' }
  const videos = files.filter(isVideoFile)
  const images = files.filter((f) => !isVideoFile(f))
  if (videos.length) {
    const v = videos[0]
    if (existing.length || images.length) return { take: [], note: 'X allows one video or up to 4 images per post, not both.' }
    if (v.size > MAX_VIDEO_BYTES) return { take: [], note: 'That video is over X’s 512MB limit.' }
    return { take: [v], note: videos.length > 1 ? 'Only one video per post, kept the first.' : null }
  }
  const room = MAX_MEDIA - existing.length
  const take = images.slice(0, Math.max(0, room))
  return { take, note: take.length < images.length ? `Up to ${MAX_MEDIA} images per post.` : null }
}

// Ask the browser not to evict our storage under pressure (videos are big). Best effort.
export const persistStorage = () => navigator.storage?.persist?.().catch(() => false)

let dbPromise: Promise<IDBDatabase> | null = null
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const urls = new Map<string, string>()
// Ids written this session; cleanup skips them so a just-added image is never collected mid-save
const fresh = new Set<string>()

export async function putImage(blob: Blob, id: string = (blob.type.startsWith('video/') ? 'v_' : '') + crypto.randomUUID()) {
  fresh.add(id)
  await tx('readwrite', (s) => s.put(blob, id))
  return id
}

export const getImage = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))

export async function deleteImage(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  const url = urls.get(id)
  if (url) URL.revokeObjectURL(url)
  urls.delete(id)
}

export const allImageIds = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String))

export async function collectGarbage(used: Set<string>) {
  for (const id of await allImageIds()) if (!used.has(id) && !fresh.has(id)) await deleteImage(id)
}

export function useImageUrl(id: string) {
  const [url, setUrl] = useState(() => urls.get(id) ?? null)
  useEffect(() => {
    if (urls.has(id)) {
      setUrl(urls.get(id)!)
      return
    }
    let alive = true
    getImage(id).then((blob) => {
      if (!alive || !blob) return
      const u = urls.get(id) ?? URL.createObjectURL(blob)
      urls.set(id, u)
      setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [id])
  return url
}

// Downscale huge photos so storage stays sane; X recompresses anyway. GIFs are kept as-is (animation).
export async function prepareImage(file: File, maxSide = 2400): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 3_000_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return await new Promise((r) => canvas.toBlob((b) => r(b ?? file), type, 0.9))
  } catch {
    return file
  }
}

// Clipboard only reliably accepts PNG, so convert before copying.
export async function copyImage(id: string) {
  const blob = await getImage(id)
  if (!blob) return false
  const png =
    blob.type === 'image/png'
      ? blob
      : await createImageBitmap(blob).then((bmp) => {
          const c = document.createElement('canvas')
          c.width = bmp.width
          c.height = bmp.height
          c.getContext('2d')!.drawImage(bmp, 0, 0)
          return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
        })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  return true
}

export async function downloadImage(id: string, name: string) {
  const blob = await getImage(id)
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
  a.download = `${name}.${ext.replace('quicktime', 'mov').split(';')[0]}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

export const dataUrlToBlob = (url: string) => fetch(url).then((r) => r.blob())

export const mediaFiles = (list: FileList | DataTransferItemList | null | undefined): File[] => {
  if (!list) return []
  const out: File[] = []
  for (const item of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const f = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null
    if (f && (f.type.startsWith('image/') || f.type.startsWith('video/'))) out.push(f)
  }
  return out
}
