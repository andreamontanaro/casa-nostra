'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ProfileFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
}

export async function updateDisplayName(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const displayName = (formData.get('display_name') as string ?? '').trim()
  if (!displayName) {
    return { fieldErrors: { display_name: 'Il nome non può essere vuoto.' } }
  }
  if (displayName.length > 60) {
    return { fieldErrors: { display_name: 'Massimo 60 caratteri.' } }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidatePath('/', 'layout')
  redirect('/impostazioni?ok=profile-updated')
}

export async function updatePassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'Non autenticato.' }

  const currentPassword = formData.get('current_password') as string ?? ''
  const newPassword = formData.get('new_password') as string ?? ''
  const confirmPassword = formData.get('confirm_password') as string ?? ''

  const fieldErrors: Record<string, string> = {}
  if (!currentPassword) fieldErrors.current_password = 'Inserisci la password attuale.'
  if (!newPassword) fieldErrors.new_password = 'Inserisci la nuova password.'
  else if (newPassword.length < 8) fieldErrors.new_password = 'Almeno 8 caratteri.'
  if (newPassword !== confirmPassword) {
    fieldErrors.confirm_password = 'Le password non coincidono.'
  }
  if (newPassword && currentPassword && newPassword === currentPassword) {
    fieldErrors.new_password = 'La nuova password deve essere diversa.'
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) {
    return { fieldErrors: { current_password: 'Password attuale errata.' } }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (updateError) {
    return { error: 'Errore durante il cambio password. Riprova.' }
  }

  redirect('/impostazioni?ok=password-updated')
}
