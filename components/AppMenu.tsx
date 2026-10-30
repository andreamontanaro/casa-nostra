'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AccentPicker } from '@/components/AccentPicker'
import { APP_MENU_OPEN_EVENT } from '@/lib/app-menu'
import {
  NAV_PRIMARY,
  NAV_SECONDARY,
  activeNavHref,
  type NavItem,
} from '@/lib/nav'
import { cn } from '@/lib/utils'

/**
 * Il menu con la navigazione completa. È il menu, non la barra in basso, a
 * contenere *tutte* le schermate: la barra resta un accesso rapido alle cinque
 * più frequenti, e ogni nuova sezione dell'app entra qui senza doverne
 * spostare un'altra (`lib/nav.ts`). Lo apre il cerchio con l'iniziale
 * nell'intestazione di ogni pagina (`HeaderActions`), tramite `openAppMenu`.
 */
export function AppMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(APP_MENU_OPEN_EVENT, show)
    return () => window.removeEventListener(APP_MENU_OPEN_EVENT, show)
  }, [])

  const allItems = [...NAV_PRIMARY, ...NAV_SECONDARY]
  const active = activeNavHref(pathname, allItems)

  return (
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
          <AccentPicker />
        </div>
      </nav>
    </Sheet>
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
