import { useState } from 'react'
import { isVideo, useImageUrl } from '../lib/media'
import { IconCheck, IconCopy, IconDownload, IconX } from './Icons'

type Props = {
  ids: string[]
  onRemove: (id: string) => void
  onCopy: (id: string) => Promise<boolean>
  onDownload: (id: string) => void
}

function Tile({ id, onRemove, onCopy, onDownload }: { id: string } & Omit<Props, 'ids'>) {
  const url = useImageUrl(id)
  const video = isVideo(id)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const copy = async () => {
    const ok = await onCopy(id)
    setCopied(ok ? 'ok' : 'fail')
    window.setTimeout(() => setCopied(null), 1400)
  }
  return (
    <div className="tile">
      {!url ? (
        <div className="tile-ph" />
      ) : video ? (
        <video src={url} controls playsInline preload="metadata" />
      ) : (
        <img src={url} alt="" draggable />
      )}
      <button className="tile-x" title={video ? 'Remove video' : 'Remove image'} onClick={() => onRemove(id)}>
        <IconX size={15} />
      </button>
      <div className="tile-actions">
        {!video && (
          <button title="Copy image (then paste into X)" onClick={copy}>
            {copied === 'ok' ? <IconCheck size={15} /> : <IconCopy size={15} />}
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Failed' : 'Copy'}
          </button>
        )}
        <button title={video ? 'Download video' : 'Download image'} onClick={() => onDownload(id)}>
          <IconDownload size={15} />
          {video && 'Download'}
        </button>
      </div>
    </div>
  )
}

export function MediaGrid({ ids, ...rest }: Props) {
  if (!ids.length) return null
  return (
    <div className={`media n${ids.length}`}>
      {ids.map((id) => (
        <Tile key={id} id={id} {...rest} />
      ))}
    </div>
  )
}
