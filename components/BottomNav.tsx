'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Home, List, ArrowLeftRight, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/spese', label: 'Storico', icon: List },
  { href: '/conguaglio', label: 'Conguaglio', icon: ArrowLeftRight },
  { href: '/statistiche', label: 'Statistiche', icon: BarChart3 },
  { href: '/impostazioni', label: 'Impostazioni', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-40 border-t border-border',
        'bg-surface/70 backdrop-blur-xl backdrop-saturate-150',
        'supports-[backdrop-filter]:bg-surface/65',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.08)]',
      )}
    >
      <ul className="mx-auto flex h-16 w-full max-w-lg px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  'transition-colors duration-200',
                  active ? 'text-accent' : 'text-muted',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="absolute inset-x-3 inset-y-1.5 -z-10 rounded-2xl bg-accent-muted"
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.05 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                </motion.span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
