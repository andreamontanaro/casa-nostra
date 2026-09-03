'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Home,
  List,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react'
import { springLayout, springSnappy } from '@/lib/motion'
import { cn } from '@/lib/utils'

// Statistiche vive nel menu dell'header (AppHeader), non qui: le faccende
// sono l'interazione più frequente dell'app, il conguaglio la più rara — la
// barra riflette la frequenza d'uso (docs/design-modulo-gestione-casa.md § 6).
const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/spese', label: 'Storico', icon: List },
  { href: '/casa', label: 'Casa', icon: Sparkles },
  { href: '/conguaglio', label: 'Conguaglio', icon: ArrowLeftRight },
]

export function BottomNav() {
  const pathname = usePathname()

  // Tab attivo: l'href più lungo che è prefisso del pathname corrente.
  const activeHref = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (it) => pathname === it.href || pathname.startsWith(`${it.href}/`),
    )?.href

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-40 border-t border-border',
        'bg-surface/70 backdrop-blur-xl backdrop-saturate-150',
        'supports-[backdrop-filter]:bg-surface/65',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-nav',
      )}
    >
      <ul className="mx-auto flex h-16 w-full max-w-lg px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
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
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
