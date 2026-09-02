'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Settings, ChevronRight } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const [open, setOpen] = useState(false)

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
            aria-label="Apri menu"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl text-foreground',
              'transition-[background-color,transform] duration-150',
              'hover:bg-surface-raised active:scale-95',
            )}
          >
            <Menu className="size-6" />
          </button>
          <span className="text-base font-semibold text-foreground">Casa Nostra</span>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <nav className="flex flex-col gap-1.5 px-4 pb-4 pt-2">
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
