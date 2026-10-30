'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House } from 'lucide-react'
import { NAV_PRIMARY, NAV_SECONDARY, activeNavHref } from '@/lib/nav'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AccentPicker } from '@/components/AccentPicker'
import { cn } from '@/lib/utils'

export function DesktopNav() {
  const pathname = usePathname()
  const items = [...NAV_PRIMARY, ...NAV_SECONDARY]
  const active = activeNavHref(pathname, items)
  return (
    <aside className="fixed top-6 bottom-6 left-[max(1.5rem,calc((100vw-72rem)/2+1rem))] hidden w-52 flex-col gap-6 lg:flex">
      {/* Senza top bar il nome dell'app sta qui, in cima alla colonna. */}
      <Link href="/" className="flex min-h-12 items-center gap-2.5 px-2">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-accent-muted text-accent"><House className="size-5" aria-hidden /></span>
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">Casa Nostra<span className="text-accent">.</span></span>
      </Link>
      <nav aria-label="Navigazione principale" className="flex flex-col gap-1.5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active === href ? 'page' : undefined}
            className={cn('flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors',
              active === href ? 'bg-accent-muted text-accent-soft' : 'text-muted hover:bg-surface')}>
            <Icon className="size-5" aria-hidden />{label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2"><ThemeToggle /><AccentPicker /></div>
    </aside>
  )
}
