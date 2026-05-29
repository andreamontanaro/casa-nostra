'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, X, FileText } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/lib/toast'
import {
  ACCEPTED_MIME,
  MAX_FILES,
  validateFiles,
  uploadAttachments,
  isImageMime,
} from '@/lib/attachments'
import { formatBytes } from '@/lib/fmt'
import { cn } from '@/lib/utils'

const ACCEPT = ACCEPTED_MIME.join(',')

type DeferredProps = {
  mode: 'deferred'
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
}

type ImmediateProps = {
  mode: 'immediate'
  expenseId: string
  uploadedBy: string
  existingCount: number
  disabled?: boolean
}

type Props = DeferredProps | ImmediateProps

export function AttachmentUploader(props: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const existingCount =
    props.mode === 'deferred' ? props.files.length : props.existingCount
  const remaining = MAX_FILES - existingCount
  const blocked = !!props.disabled || uploading || remaining <= 0

  function openPicker() {
    inputRef.current?.click()
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // permette di riselezionare lo stesso file
    if (picked.length === 0) return

    const { valid, errors } = validateFiles(existingCount, picked)
    errors.forEach((msg) => toast.error(msg))
    if (valid.length === 0) return

    if (props.mode === 'deferred') {
      props.onFilesChange([...props.files, ...valid])
      return
    }

    setUploading(true)
    const results = await uploadAttachments(props.expenseId, valid, props.uploadedBy)
    setUploading(false)

    const okCount = results.filter((r) => r.ok).length
    const failCount = results.length - okCount
    if (okCount > 0) {
      toast.success(okCount === 1 ? 'Allegato caricato.' : `${okCount} allegati caricati.`)
    }
    if (failCount > 0) {
      toast.error(
        failCount === 1
          ? 'Un allegato non è stato caricato.'
          : `${failCount} allegati non caricati.`,
      )
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleSelect}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={blocked}
        className={cn(
          'flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-border',
          'bg-surface text-sm font-medium text-muted',
          'transition-[border-color,color,transform] duration-150 active:scale-[0.98]',
          'hover:border-accent/50 hover:text-foreground',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        )}
      >
        {uploading ? (
          <Spinner size="sm" />
        ) : (
          <Paperclip className="size-4" />
        )}
        {remaining <= 0
          ? `Massimo ${MAX_FILES} allegati`
          : uploading
            ? 'Caricamento…'
            : 'Aggiungi allegato'}
      </button>

      {props.mode === 'deferred' && props.files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {props.files.map((file, i) => (
            <PendingRow
              key={`${file.name}-${i}`}
              file={file}
              disabled={props.disabled}
              onRemove={() =>
                props.onFilesChange(props.files.filter((_, idx) => idx !== i))
              }
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        JPG, PNG o PDF · max {MAX_FILES} file da 10 MB
      </p>
    </div>
  )
}

function PendingRow({
  file,
  onRemove,
  disabled,
}: {
  file: File
  onRemove: () => void
  disabled?: boolean
}) {
  const previewUrl = useMemo(
    () => (isImageMime(file.type) ? URL.createObjectURL(file) : null),
    [file],
  )

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-raised">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <FileText className="size-5 text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted tabular-nums">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Rimuovi allegato"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-destructive transition-colors disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}
