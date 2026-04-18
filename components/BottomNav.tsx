'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, ArrowLeftRight } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/spese', label: 'Storico', icon: List },
  { href: '/conguaglio', label: 'Conguaglio', icon: ArrowLeftRight },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={[
                  'flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                  active ? 'text-accent' : 'text-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
