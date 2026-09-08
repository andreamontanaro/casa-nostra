'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return <div className="relative">
    <Input {...props} type={visible ? 'text' : 'password'} className="pr-14" />
    <button type="button" aria-label={(visible ? 'Nascondi ' : 'Mostra ') + (props.label?.toLowerCase() ?? 'password')} aria-pressed={visible}
      disabled={props.disabled} onClick={() => setVisible(!visible)} className="absolute right-1 top-[1.625rem] flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-raised"><Icon className="size-5" aria-hidden /></button>
  </div>
}
