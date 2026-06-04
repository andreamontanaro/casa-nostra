import { createClient } from '@/lib/supabase/browser'

export const CAR_PHOTOS_BUCKET = 'car-photos'

export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ACCEPTED_PHOTO_MIME = ['image/jpeg', 'image/png'] as const
export type AcceptedPhotoMime = (typeof ACCEPTED_PHOTO_MIME)[number]

const EXT_BY_MIME: Record<AcceptedPhotoMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Valida una singola foto (tipo + dimensione). Ritorna il messaggio d'errore o null. */
export function validateCarPhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_MIME.includes(file.type as AcceptedPhotoMime)) {
    return 'Formato non supportato (solo JPG o PNG).'
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return 'La foto supera i 10 MB.'
  }
  return null
}

function buildPhotoPath(ownerId: string, carId: string, mime: string): string {
  const ext = EXT_BY_MIME[mime as AcceptedPhotoMime] ?? 'jpg'
  return `${ownerId}/${carId}/${crypto.randomUUID()}.${ext}`
}

export type PhotoUploadResult = { ok: boolean; path: string | null }

/**
 * Carica la foto nel bucket privato e aggiorna cars.photo_path. Da usare lato
 * client (browser): l'utente e' coperto dalla policy owner-scoped per cartella.
 * Se l'update fallisce rimuove il file appena caricato. Se `oldPath` e' fornito
 * (sostituzione), elimina la vecchia foto al termine.
 */
export async function uploadCarPhoto(
  carId: string,
  ownerId: string,
  file: File,
  oldPath?: string | null,
): Promise<PhotoUploadResult> {
  const supabase = createClient()
  const path = buildPhotoPath(ownerId, carId, file.type)

  const { error: uploadError } = await supabase.storage
    .from(CAR_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) return { ok: false, path: null }

  const { error: updateError } = await supabase
    .from('cars')
    .update({ photo_path: path })
    .eq('id', carId)

  if (updateError) {
    await supabase.storage.from(CAR_PHOTOS_BUCKET).remove([path])
    return { ok: false, path: null }
  }

  if (oldPath && oldPath !== path) {
    await supabase.storage.from(CAR_PHOTOS_BUCKET).remove([oldPath])
  }

  return { ok: true, path }
}
