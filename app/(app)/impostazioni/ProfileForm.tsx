'use client'

import { useActionState } from 'react'
import { updateDisplayName, type ProfileFormState } from '@/app/actions/profile'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initialState: ProfileFormState = {}

interface Props {
  currentDisplayName: string
  email: string
}

export function ProfileForm({ currentDisplayName, email }: Props) {
  const [state, action, pending] = useActionState(updateDisplayName, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Email</label>
        <div className="h-11 w-full rounded-2xl border border-border bg-surface-sunken px-4 flex items-center text-base text-muted">
          {email}
        </div>
      </div>

      <Input
        label="Nome visualizzato"
        name="display_name"
        defaultValue={currentDisplayName}
        maxLength={60}
        required
        disabled={pending}
        error={state.fieldErrors?.display_name}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} size="md" className="self-end">
        Salva
      </Button>
    </form>
  )
}
