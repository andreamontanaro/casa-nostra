import { cn } from '@/lib/utils'

/**
 * Barra segnaposto. È decorativa (`aria-hidden`): l'attesa la annuncia una
 * volta sola `SkeletonPage`, non ogni singola barra.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  /** Solo per misure che non stanno in una classe, es. l'altezza di una colonna. */
  style?: React.CSSProperties
}) {
  return <div aria-hidden style={style} className={cn('shimmer rounded-xl', className)} />
}

/**
 * Contenitore di una schermata in caricamento.
 *
 * Va usato con **le stesse classi di layout del contenitore della pagina
 * vera** — padding, gap, griglia, max-width, barre sticky — perché lo
 * scheletro deve occupare esattamente lo spazio che occuperà il contenuto:
 * quando i dati arrivano non si muove niente sotto il dito. Per la stessa
 * ragione le altezze delle righe si fissano con `min-h-*` sul contenitore
 * (l'altezza vera, data dal box di testo o dal touch target) e le barre
 * dentro restano più sottili: sembrano testo, non blocchi pieni.
 */
export function SkeletonPage({
  label = 'Caricamento…',
  className,
  children,
}: {
  /** Cosa sta caricando, per chi usa uno screen reader. */
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </div>
  )
}

/**
 * Riga con la geometria di `ListRow` (icona, due righe di testo, valore a
 * destra). `leading` e `trailing` restano liberi perché il contenuto a lato
 * cambia da lista a lista, ma il passo della riga no.
 */
export function SkeletonListRow({
  leading,
  trailing,
  titleClassName = 'w-2/3',
  subtitleClassName = 'w-1/3',
  className,
}: {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  titleClassName?: string
  /** `null` per una riga a una sola riga di testo. */
  subtitleClassName?: string | null
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <Skeleton className={cn('h-4 rounded-md', titleClassName)} />
        {subtitleClassName !== null && (
          <Skeleton className={cn('mt-1.5 h-3 rounded-md', subtitleClassName)} />
        )}
      </div>
      {trailing}
    </div>
  )
}

/**
 * Segnaposto di un bottone icona da 44px (i "torna indietro", le azioni di
 * riga): il touch target resta quello vero, la barra dentro è l'icona.
 */
export function SkeletonIconButton({ className }: { className?: string }) {
  return (
    <div className={cn('flex size-11 shrink-0 items-center justify-center', className)}>
      <Skeleton className="size-5 rounded-md" />
    </div>
  )
}

/**
 * Segnaposto di un campo con etichetta (`Input`, `AmountInput`): etichetta
 * sottile sopra, campo alto come quello vero.
 */
export function SkeletonField({
  labelClassName = 'w-24',
  fieldClassName = 'h-12',
}: {
  labelClassName?: string
  fieldClassName?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={cn('h-4 rounded-md', labelClassName)} />
      <Skeleton className={cn('w-full rounded-2xl', fieldClassName)} />
    </div>
  )
}

/**
 * Segnaposto di un chip (filtro, suggerimento, data): il bordo è quello vero
 * del chip non selezionato, dentro shimmera solo l'etichetta. Una pillola
 * piena sembrerebbe un chip attivo, e così tutta la fila sembrerebbe scelta.
 */
export function SkeletonChip({ className = 'w-16' }: { className?: string }) {
  return (
    <div className="flex min-h-11 shrink-0 items-center rounded-full border border-border-strong px-3.5">
      <Skeleton className={cn('h-4 rounded-md', className)} />
    </div>
  )
}

/**
 * Segnaposto di `SegmentedControl` / `ThemeToggle`: la pista tonale e il
 * segmento selezionato sono quelli veri, shimmerano solo le etichette.
 */
export function SkeletonSegmented({
  segments,
  /** Quale segmento è selezionato all'apertura della schermata. */
  activeIndex = 0,
  segmentClassName = 'min-h-11',
}: {
  segments: number
  activeIndex?: number
  segmentClassName?: string
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-surface-raised p-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center rounded-xl',
            segmentClassName,
            i === activeIndex && 'bg-surface shadow-soft',
          )}
        >
          <Skeleton className="h-4 w-3/5 rounded-md" />
        </div>
      ))}
    </div>
  )
}
