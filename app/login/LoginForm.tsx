'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initialState: LoginState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        disabled={pending}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={pending}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} size="lg" className="mt-2 w-full">
        Accedi
      </Button>
    </form>
  )
}
