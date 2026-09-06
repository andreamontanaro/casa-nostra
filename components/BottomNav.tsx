'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { BOTTOM_NAV_ITEMS, BOTTOM_NAV_LABELS, activeNavHref } from '@/lib/nav'
import { springLayout, springSnappy } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Accesso rapido alle quattro schermate che si aprono più volte al giorno.
 * L'elenco completo delle sezioni sta nel menu dell'header: la barra riflette
 * la frequenza d'uso, non la mappa dell'app — quindi non cresce quando
 * arriva un modulo nuovo. Voci e ordine in `lib/nav.ts`.
 */
export function BottomNav() {
  const pathname = usePathname()
  const activeHref = activeNavHref(pathname, BOTTOM_NAV_ITEMS)

  return (
    <nav
      className={cn(
        // Nascosta mentre si scrive: sotto la tastiera è invisibile su iOS e
        // su Android ruberebbe 4rem al form (vedi .hide-on-keyboard).
        'fixed bottom-0 inset-x-0 z-40 border-t border-border hide-on-keyboard',
        'bg-surface/70 backdrop-blur-xl backdrop-saturate-150',
        'supports-[backdrop-filter]:bg-surface/65',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-nav',
      )}
    >
      <ul className="mx-auto flex h-16 w-full max-w-lg px-2">
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref
          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium',
                  'transition-colors duration-200',
                  active ? 'text-foreground' : 'text-muted',
                )}
              >
                {/* Active indicator M3: pillola dietro la sola icona */}
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={springLayout}
                      className="absolute inset-0 rounded-full bg-accent-muted"
                    />
                  )}
                  <motion.span
                    animate={{ scale: active ? 1.05 : 1 }}
                    transition={springSnappy}
                    className={cn('relative', active ? 'text-accent-soft' : 'text-muted')}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                  </motion.span>
                </span>
                {BOTTOM_NAV_LABELS[href] ?? label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
