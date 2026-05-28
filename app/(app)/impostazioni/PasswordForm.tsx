'use client'

import { useActionState, useEffect, useRef } from 'react'
import { updatePassword, type ProfileFormState } from '@/app/actions/profile'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initialState: ProfileFormState = {}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Pulisci i campi quando la action ha avuto successo (no errore e no fieldErrors)
  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) {
      formRef.current?.reset()
    }
  }, [pending, state])

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Input
        label="Password attuale"
        name="current_password"
        type="password"
        autoComplete="current-password"
        required
        disabled={pending}
        error={state.fieldErrors?.current_password}
      />
      <Input
        label="Nuova password"
        name="new_password"
        type="password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state.fieldErrors?.new_password}
      />
      <Input
        label="Conferma nuova password"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        required
        disabled={pending}
        error={state.fieldErrors?.confirm_password}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} size="md" className="self-end">
        Cambia password
      </Button>
    </form>
  )
}
