'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ChevronRight, House, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  NAV_PRIMARY,
  NAV_SECONDARY,
  activeNavHref,
  type NavItem,
} from '@/lib/nav'
import { openAssistant } from '@/lib/assistant/ui'
import { cn } from '@/lib/utils'

/**
 * Header con il menu di navigazione completo. È il menu, non la barra in
 * basso, a contenere *tutte* le schermate: la barra resta un accesso rapido
 * alle tre più frequenti, e ogni nuova sezione dell'app entra qui senza
 * doverne spostare un'altra (`lib/nav.ts`).
 */
export function AppHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const allItems = [...NAV_PRIMARY, ...NAV_SECONDARY]
  const active = activeNavHref(pathname, allItems)

  return (
    <>
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-40 border-b border-border',
          'bg-background/95 backdrop-blur-md',
          'pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri menu"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-foreground',
              'transition-[background-color,transform] duration-150',
              'hover:bg-surface-raised active:scale-95',
            )}
          >
            <Menu className="size-6" />
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="hidden size-9 items-center justify-center rounded-2xl bg-accent-muted text-accent sm:flex"><House className="size-5" aria-hidden /></span>
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">Casa Nostra<span className="text-accent">.</span></span>
          </Link>
          <button type="button" onClick={() => openAssistant()} aria-label="Apri l’assistente"
            className="ml-auto flex min-h-11 items-center gap-2 rounded-full bg-accent-muted px-3 text-sm font-semibold text-accent-soft">
            <Sparkles className="size-4" aria-hidden /><span className="hidden sm:inline">Assistente</span>
          </button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <nav className="flex flex-col gap-1 px-4 pb-4 pt-1">
          {NAV_PRIMARY.map((item) => (
            <MenuLink
              key={item.href}
              item={item}
              active={item.href === active}
              onNavigate={() => setOpen(false)}
            />
          ))}

          <div className="my-2 h-px bg-border" />

          {NAV_SECONDARY.map((item) => (
            <MenuLink
              key={item.href}
              item={item}
              active={item.href === active}
              onNavigate={() => setOpen(false)}
            />
          ))}

          <div className="my-2 h-px bg-border" />

          <div className="flex flex-col gap-2 px-1 pb-1">
            <span className="text-label font-medium text-muted">Tema</span>
            <ThemeToggle />
          </div>
        </nav>
      </Sheet>
    </>
  )
}

function MenuLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: () => void
}) {
  const { href, label, description, icon: Icon } = item

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-2.5',
        'transition-colors duration-150',
        active ? 'bg-accent-muted' : 'hover:bg-surface-raised',
      )}
    >
      <Icon className={cn('size-5 shrink-0', active ? 'text-accent-soft' : 'text-muted')} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-medium',
            active ? 'text-accent-soft' : 'text-foreground',
          )}
        >
          {label}
        </span>
        <span className="block truncate text-xs text-muted">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  )
}
