'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Home, Car, Settings, ChevronRight } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

const MODULES = [
  { href: '/', label: 'Casa Nostra', desc: 'Spese condivise', icon: Home },
  { href: '/auto', label: 'Le mie auto', desc: 'Rifornimenti e consumi', icon: Car },
]

export function AppHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isAuto = pathname.startsWith('/auto')
  const title = isAuto ? 'Le mie auto' : 'Casa Nostra'

  return (
    <>
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-40 border-b border-border',
          'bg-surface/70 backdrop-blur-xl backdrop-saturate-150',
          'supports-[backdrop-filter]:bg-surface/65',
          'pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri menu moduli"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl text-foreground',
              'transition-[background-color,transform] duration-150',
              'hover:bg-surface-raised active:scale-95',
            )}
          >
            <Menu className="size-6" />
          </button>
          <span className="text-base font-semibold text-foreground">{title}</span>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen} title="Moduli">
        <nav className="flex flex-col gap-1.5 px-4 pb-4 pt-2">
          {MODULES.map(({ href, label, desc, icon: Icon }) => {
            const active =
              href === '/auto' ? isAuto : !isAuto
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3 py-3',
                  'transition-[border-color,background-color] duration-150',
                  active
                    ? 'border-transparent bg-accent-muted'
                    : 'border-border bg-surface hover:border-accent/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-accent text-accent-foreground' : 'bg-surface-raised text-muted',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      active ? 'text-accent-soft' : 'text-foreground',
                    )}
                  >
                    {label}
                  </span>
                  <span className="block truncate text-xs text-muted">{desc}</span>
                </span>
              </Link>
            )
          })}

          <div className="my-1.5 h-px bg-border" />

          <Link
            href="/impostazioni"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2.5',
              'text-sm font-medium text-foreground',
              'transition-colors duration-150 hover:bg-surface-raised',
            )}
          >
            <Settings className="size-5 text-muted" />
            <span className="flex-1">Impostazioni</span>
            <ChevronRight className="size-4 text-muted" />
          </Link>

          <div className="my-1.5 h-px bg-border" />

          <div className="flex flex-col gap-2 px-1">
            <span className="text-label font-medium text-muted">Tema</span>
            <ThemeToggle />
          </div>
        </nav>
      </Sheet>
    </>
  )
}
