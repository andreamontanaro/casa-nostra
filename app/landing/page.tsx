import type { Metadata } from 'next'
import {
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  Check,
  ListFilter,
  Lock,
  Paperclip,
  Receipt,
  Scale,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Reveal, CtaLink, Typewriter } from './LandingReveal'

export const metadata: Metadata = {
  title: 'Casa Nostra — Le spese di casa, in chiaro tra voi due',
  description:
    'App mobile-first per gestire le spese condivise tra conviventi: divisione personalizzabile per ogni tipologia di spesa, saldo sempre aggiornato, conguaglio in un tap e un assistente IA che capisce le tue spese.',
}

const useCases = [
  {
    icon: Users,
    title: 'Conviventi e coppie',
    body: 'Pensata per due persone che dividono la casa. Ogni spesa inserita è, per definizione, condivisa.',
  },
  {
    icon: Receipt,
    title: 'Spese di tutti i giorni',
    body: 'Affitto, bollette, spesa al supermercato, abbonamenti, manutenzione, viaggi: tutto in un posto solo.',
  },
  {
    icon: Scale,
    title: 'Addio fogli Excel',
    body: 'Niente più calcoli a mano o discussioni su «chi ha pagato cosa». Il saldo lo tiene l’app.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Inserisci la spesa',
    body: 'Importo, descrizione, categoria, chi ha pagato. In meno di 30 secondi è registrata.',
  },
  {
    n: '2',
    title: 'La divisione la decidi tu',
    body: 'Imposti come dividere ogni tipologia di spesa: l’app propone il default giusto e tu lo personalizzi quando serve.',
  },
  {
    n: '3',
    title: 'Il saldo è sempre aggiornato',
    body: 'In ogni momento vedi chi deve quanto all’altro. Calcolato dal server, mai approssimato.',
  },
  {
    n: '4',
    title: 'Conguaglio in un tap',
    body: 'Quando uno bonifica all’altro la differenza, chiudi tutto e riparti da zero.',
  },
]

const features = [
  {
    icon: Wallet,
    title: 'Spese e categorie',
    body: 'Affitto, bollette, spesa, abbonamenti, manutenzione, viaggi e altro — ognuna con la sua icona.',
  },
  {
    icon: Scale,
    title: 'Divisione personalizzabile',
    body: 'Scegli come dividere ogni tipologia di spesa, con anteprima della tua parte in tempo reale.',
  },
  {
    icon: Paperclip,
    title: 'Allegati e scontrini',
    body: 'Foto o PDF delle ricevute caricati in sicurezza, sempre a portata di tap.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Saldo e conguaglio',
    body: 'Saldo netto coerente in tempo reale e conguaglio transazionale, anche solo su alcune spese.',
  },
  {
    icon: ListFilter,
    title: 'Storico con filtri',
    body: 'Cerca per testo, filtra per stato, periodo e categoria. Tutto fluido, senza ricaricare.',
  },
  {
    icon: BarChart3,
    title: 'Statistiche',
    body: 'Volume del periodo, trend degli ultimi 12 mesi, spese per categoria e storico dei conguagli.',
  },
]

const chat = [
  { role: 'user', text: 'Quanto abbiamo speso questa settimana?' },
  {
    role: 'ai',
    text: 'Questa settimana avete speso **142,30 €** in 6 spese. La voce più alta è la spesa al supermercato (54,90 €).',
  },
  { role: 'user', text: 'Aggiungi 40€ al Lidl, ho pagato io' },
  {
    role: 'ai',
    text: '✓ Spesa registrata: **40,00 €** · Spesa alimentare · pagata da te. Vuoi modificarla?',
  },
]

function InviteNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center justify-center gap-1.5 text-xs text-muted', className)}>
      <Lock className="size-3.5" strokeWidth={2} />
      Accesso su invito: l&rsquo;app è riservata a chi ha già un account.
    </p>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/60 backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-7" />
            <span className="text-base font-semibold tracking-tight">Casa Nostra</span>
          </div>
          <CtaLink href="/login" size="sm">
            Accedi
          </CtaLink>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-14 pb-10 text-center sm:pt-20">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="block">
            <Typewriter />
          </span>
          <span className="mt-1 block">
            in chiaro{' '}
            <span className="underline decoration-accent decoration-2 underline-offset-4">
              tra voi due
            </span>
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
          Ogni spesa è condivisa per definizione. La divisione è personalizzabile per ogni
          tipologia di spesa, con un saldo sempre aggiornato e il conguaglio in un tap.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          <CtaLink href="/login" size="lg" className="w-full max-w-xs gap-2">
            Accedi
            <ArrowRight className="size-5" strokeWidth={2.4} />
          </CtaLink>
          <InviteNote />
        </div>

        {/* Mock card del saldo */}
        <div className="mx-auto mt-10 max-w-sm">
          <div className="rounded-3xl bg-gradient-to-br from-accent via-accent to-accent-soft p-5 text-left text-accent-foreground shadow-card">
            <p className="text-sm/none opacity-80">Saldo corrente</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">128,40 €</p>
            <p className="mt-1 text-sm opacity-90">Giulia deve a Marco</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 text-xs">
              <div>
                <p className="opacity-80">Hai anticipato</p>
                <p className="mt-0.5 font-semibold tabular-nums">540,00 €</p>
              </div>
              <div>
                <p className="opacity-80">Marco ha messo</p>
                <p className="mt-0.5 font-semibold tabular-nums">283,20 €</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Casi d'uso */}
      <Reveal className="mx-auto w-full max-w-3xl px-4 py-10">
        <h2 className="text-center text-2xl font-bold tracking-tight">Per chi è</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {useCases.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* Come funziona */}
      <Reveal className="bg-surface-sunken/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold tracking-tight">Come funziona</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted">
            Quattro passi, dall&rsquo;inserimento al conguaglio.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {steps.map(({ n, title, body }) => (
              <li
                key={n}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {n}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* Funzionalità */}
      <Reveal className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold tracking-tight">Tutto quello che serve</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Assistente IA */}
      <Reveal className="bg-surface-sunken/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-14">
          <div className="text-center">
            <Badge variant="accent" className="mb-4">
              <Sparkles className="mr-1 size-3.5" strokeWidth={2.2} />
              Assistente IA
            </Badge>
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Parla con le tue spese
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
              Un assistente intelligente integrato nell&rsquo;app, sempre a un tap di distanza
              dalla nuvoletta flottante. Capisce le tue spese e ti dà una mano.
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-center">
            {/* Capacità */}
            <ul className="space-y-3">
              {[
                {
                  t: 'Chiedi in linguaggio naturale',
                  d: '«Quanto ho speso questa settimana?», «Chi deve a chi?» — risponde con i dati reali.',
                },
                {
                  t: 'Aggiungi una spesa dal testo',
                  d: 'Scrivi «40€ al Lidl, ho pagato io»: l’assistente la riepiloga, chiede conferma e la registra.',
                },
                {
                  t: 'Legge gli scontrini',
                  d: 'Apre foto e PDF allegati a una spesa per dirti cosa contengono.',
                },
                {
                  t: 'Sempre con dati aggiornati',
                  d: 'Conosce saldo, spese, categorie e profili: niente risposte inventate.',
                },
              ].map(({ t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Mock chat */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Sparkles className="size-4" strokeWidth={2.2} />
                </span>
                <span className="text-sm font-semibold">Assistente Casa Nostra</span>
              </div>
              <div className="space-y-3 p-4">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'ml-auto bg-accent text-accent-foreground'
                        : 'mr-auto bg-surface-raised text-foreground',
                    )}
                    dangerouslySetInnerHTML={{
                      __html: m.text.replace(
                        /\*\*(.+?)\*\*/g,
                        '<strong class="font-semibold">$1</strong>',
                      ),
                    }}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </Reveal>

      {/* CTA finale */}
      <Reveal className="mx-auto w-full max-w-3xl px-4 py-14 text-center">
        <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          Pronti a fare chiarezza?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Entra e tieni le spese di casa sempre in pari, senza pensieri.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <CtaLink href="/login" size="lg" className="w-full max-w-xs gap-2">
            Accedi
            <ArrowRight className="size-5" strokeWidth={2.4} />
          </CtaLink>
          <InviteNote />
        </div>
      </Reveal>

      {/* Footer */}
      <footer className="border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-1 px-4 py-8 text-center">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-5" />
            <span className="text-sm font-semibold">Casa Nostra</span>
          </div>
          <p className="text-xs text-muted">Gestione spese condivise</p>
          <p className="mt-1 text-xs text-muted">&copy; {new Date().getFullYear()} Casa Nostra</p>
        </div>
      </footer>
    </div>
  )
}
