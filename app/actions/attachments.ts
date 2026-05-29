'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ATTACHMENTS_BUCKET } from '@/lib/attachments'

export async function deleteAttachment(attachmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato.')

  const { data: row, error: fetchError } = await supabase
    .from('expense_attachments')
    .select('storage_path, expense_id')
    .eq('id', attachmentId)
    .single()

  if (fetchError || !row) throw new Error('Allegato non trovato.')

  const { error: storageError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .remove([row.storage_path])
  if (storageError) throw new Error('Errore durante la rimozione del file.')

  const { error: deleteError } = await supabase
    .from('expense_attachments')
    .delete()
    .eq('id', attachmentId)
  if (deleteError) throw new Error("Errore durante l'eliminazione dell'allegato.")

  revalidatePath(`/spese/${row.expense_id}`)
}
