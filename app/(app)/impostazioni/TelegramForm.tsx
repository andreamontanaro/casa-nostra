'use client'

import { useActionState } from 'react'
import { Check } from 'lucide-react'
import { linkTelegramAccount, type TelegramFormState } from '@/app/actions/telegram'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initialState: TelegramFormState = {}

interface Props {
  /** Id Telegram già collegato al profilo, se presente. */
  currentTelegramId: number | null
  /** L'app ha bot token e chat id configurati sul server. */
  configured: boolean
}

export function TelegramForm({ currentTelegramId, configured }: Props) {
  const [state, action, pending] = useActionState(linkTelegramAccount, initialState)

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Le notifiche Telegram non sono ancora attive: mancano le variabili
        d&apos;ambiente del bot sul server.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {currentTelegramId ? (
        <p className="flex items-center gap-2 text-sm text-positive-soft">
          <Check className="size-4 shrink-0" strokeWidth={2.5} />
          Account collegato ({currentTelegramId}).
        </p>
      ) : (
        <p className="text-sm text-muted">
          Scrivi <code className="rounded bg-surface-sunken px-1 py-0.5">/id</code> nel
          gruppo Telegram: il bot ti risponde con il tuo id. Incollalo qui per
          farti riconoscere quando scrivi all&apos;assistente.
        </p>
      )}

      <Input
        label="Id Telegram"
        name="telegram_user_id"
        inputMode="numeric"
        placeholder="123456789"
        defaultValue={currentTelegramId ?? ''}
        disabled={pending}
        error={state.fieldErrors?.telegram_user_id}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <p className="text-xs text-muted">
        Lascia il campo vuoto e salva per scollegare l&apos;account.
      </p>

      <Button type="submit" loading={pending} size="md" className="self-end">
        Salva
      </Button>
    </form>
  )
}
