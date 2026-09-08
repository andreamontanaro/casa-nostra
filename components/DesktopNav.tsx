'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_PRIMARY, NAV_SECONDARY, activeNavHref } from '@/lib/nav'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

export function DesktopNav() {
  const pathname = usePathname()
  const items = [...NAV_PRIMARY, ...NAV_SECONDARY]
  const active = activeNavHref(pathname, items)
  return (
    <aside className="fixed top-24 bottom-6 left-[max(1.5rem,calc((100vw-72rem)/2+1rem))] hidden w-52 flex-col gap-8 lg:flex">
      <nav aria-label="Navigazione principale" className="flex flex-col gap-1.5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active === href ? 'page' : undefined}
            className={cn('flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors',
              active === href ? 'bg-accent-muted text-accent-soft' : 'text-muted hover:bg-surface')}>
            <Icon className="size-5" aria-hidden />{label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto"><p className="mb-3 px-1 text-xs text-muted">Il vostro spazio, ogni giorno.</p><ThemeToggle /></div>
    </aside>
  )
}
