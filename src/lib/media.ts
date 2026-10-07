import { useEffect, useState } from 'react'

// Images live in IndexedDB (localStorage is ~5MB and strings only). Drafts reference them by id.
const DB = 'xdrafts-media'
const STORE = 'images'
export const MAX_MEDIA = 4

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

export async function putImage(blob: Blob, id: string = crypto.randomUUID()) {
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
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file
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
  a.download = `${name}.${ext}`
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

export const imageFiles = (list: FileList | DataTransferItemList | null | undefined): File[] => {
  if (!list) return []
  const out: File[] = []
  for (const item of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const f = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null
    if (f && f.type.startsWith('image/')) out.push(f)
  }
  return out
}
