import { ChoreArenaScope } from '@/components/chores/ChoreArenaScope'

/**
 * Layout di `/casa` e `/casa/catalogo`: applica il tema arcade del modulo
 * (accent violetto, sfondo a macchie di colore) come netta separazione
 * visiva dal fintech teal del resto dell'app (vedi ChoreArenaScope e
 * `.chore-arena` in app/globals.css). Il wrapper qui sotto copre il render
 * normale senza flash-of-teal; ChoreArenaScope copre in più gli overlay in
 * portale (Sheet/Dialog) applicando la classe anche su `<html>`.
 */
export default function CasaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChoreArenaScope>
      <div className="chore-arena relative isolate">
        <div
          aria-hidden
          className="chore-arena-backdrop pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] -z-10 h-[420px]"
        />
        {children}
      </div>
    </ChoreArenaScope>
  )
}
