import { createClient } from '@/lib/supabase/browser'

export const ATTACHMENTS_BUCKET = 'expense-attachments'

export const MAX_FILES = 5
export const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

export type AcceptedMime = (typeof ACCEPTED_MIME)[number]

const EXT_BY_MIME: Record<AcceptedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}

export function isImageMime(mime: string) {
  return mime === 'image/jpeg' || mime === 'image/png'
}

export type FileValidation = { valid: File[]; errors: string[] }

/**
 * Valida un insieme di file rispetto a tipo, dimensione e numero massimo,
 * tenendo conto degli allegati gia' presenti. Ritorna i file accettati e
 * i messaggi di errore (in italiano) per quelli scartati.
 */
export function validateFiles(existingCount: number, files: File[]): FileValidation {
  const valid: File[] = []
  const errors: string[] = []
  let slots = MAX_FILES - existingCount

  for (const file of files) {
    if (!ACCEPTED_MIME.includes(file.type as AcceptedMime)) {
      errors.push(`"${file.name}": formato non supportato (solo JPG, PNG o PDF).`)
      continue
    }
    if (file.size > MAX_SIZE_BYTES) {
      errors.push(`"${file.name}": supera i 10 MB.`)
      continue
    }
    if (slots <= 0) {
      errors.push(`Massimo ${MAX_FILES} allegati per spesa: "${file.name}" non aggiunto.`)
      continue
    }
    valid.push(file)
    slots--
  }

  return { valid, errors }
}

export function buildStoragePath(expenseId: string, mime: string): string {
  const ext = EXT_BY_MIME[mime as AcceptedMime] ?? 'bin'
  return `${expenseId}/${crypto.randomUUID()}.${ext}`
}

export type UploadResult = { fileName: string; ok: boolean }

/**
 * Carica i file nel bucket privato e registra i metadati in expense_attachments.
 * Da usare lato client (browser): l'utente autenticato e' coperto da RLS.
 * In caso di insert fallita rimuove il file appena caricato per non lasciare orfani.
 */
export async function uploadAttachments(
  expenseId: string,
  files: File[],
  uploadedBy: string,
): Promise<UploadResult[]> {
  const supabase = createClient()
  const results: UploadResult[] = []

  for (const file of files) {
    const path = buildStoragePath(expenseId, file.type)

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      results.push({ fileName: file.name, ok: false })
      continue
    }

    const { error: insertError } = await supabase.from('expense_attachments').insert({
      expense_id: expenseId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })

    if (insertError) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path])
      results.push({ fileName: file.name, ok: false })
      continue
    }

    results.push({ fileName: file.name, ok: true })
  }

  return results
}
