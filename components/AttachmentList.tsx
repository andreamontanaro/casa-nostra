'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Trash2, Download } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { AttachmentLightbox } from './AttachmentLightbox'
import { deleteAttachment } from '@/app/actions/attachments'
import { toast } from '@/lib/toast'
import { isImageMime } from '@/lib/attachments'
import { formatBytes } from '@/lib/fmt'
import type { AttachmentWithUrl } from '@/lib/queries'

interface AttachmentListProps {
  attachments: AttachmentWithUrl[]
  readOnly?: boolean
}

export function AttachmentList({ attachments, readOnly = false }: AttachmentListProps) {
  const router = useRouter()
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AttachmentWithUrl | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (attachments.length === 0) return null

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAttachment(deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("Errore durante l'eliminazione dell'allegato.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {attachments.map((a) => {
          const image = isImageMime(a.mime_type)
          return (
            <li
              key={a.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {image && a.signed_url ? (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({ url: a.signed_url!, name: a.file_name })
                  }
                  className="aspect-[4/3] w-full overflow-hidden bg-surface-raised"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.signed_url}
                    alt={a.file_name}
                    className="size-full object-cover transition-transform duration-200 group-active:scale-95"
                  />
                </button>
              ) : (
                <a
                  href={a.signed_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex aspect-[4/3] w-full items-center justify-center bg-surface-raised"
                >
                  <FileText className="size-10 text-muted" />
                </a>
              )}

              <div className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {a.file_name}
                  </p>
                  <p className="text-[11px] text-muted tabular-nums">
                    {formatBytes(a.size_bytes)}
                  </p>
                </div>
                {a.signed_url && (
                  <a
                    href={a.signed_url}
                    download={a.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Scarica allegato"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
                  >
                    <Download className="size-4" />
                  </a>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(a)}
                    aria-label="Elimina allegato"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <AttachmentLightbox
        url={lightbox?.url ?? null}
        fileName={lightbox?.name}
        onClose={() => setLightbox(null)}
      />

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Elimina allegato"
        description="Sei sicuro di voler eliminare questo allegato? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}
