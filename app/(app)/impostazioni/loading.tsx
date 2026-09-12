import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  Skeleton,
  SkeletonField,
  SkeletonPage,
  SkeletonSegmented,
} from '@/components/ui/Skeleton'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <Skeleton className={`h-4 rounded-md ${title}`} />
        </CardHeader>
        <CardContent className="pb-4">{children}</CardContent>
      </Card>
    </section>
  )
}

/** Bottone "Salva" allineato a destra come nelle form vere. */
function SaveButtonSkeleton({ width = 'w-24' }: { width?: string }) {
  return <Skeleton className={`h-12 self-end rounded-full ${width}`} />
}

/**
 * Scheletro delle impostazioni: le cinque sezioni fisse della pagina, ognuna
 * con la forma della sua form (profilo, Telegram, sicurezza, aspetto,
 * sessione) invece di quattro card identiche.
 */
export default function ImpostazioniLoading() {
  return (
    <SkeletonPage
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8"
      label="Caricamento delle impostazioni"
    >
      <Skeleton className="h-9 w-48 rounded-lg" />

      <Section title="w-16">
        <div className="flex flex-col gap-4">
          {/* Email: casella in sola lettura, più bassa del campo modificabile. */}
          <SkeletonField labelClassName="w-14" fieldClassName="h-11" />
          <SkeletonField labelClassName="w-36" />
          <SaveButtonSkeleton />
        </div>
      </Section>

      <Section title="w-20">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-full rounded-md" />
          <SkeletonField labelClassName="w-24" />
          <Skeleton className="h-3 w-2/3 rounded-md" />
          <SaveButtonSkeleton />
        </div>
      </Section>

      <Section title="w-24">
        <div className="flex flex-col gap-4">
          <SkeletonField labelClassName="w-32" />
          <SkeletonField labelClassName="w-28" />
          <SkeletonField labelClassName="w-44" />
          <SaveButtonSkeleton width="w-40" />
        </div>
      </Section>

      <Section title="w-20">
        <SkeletonSegmented segments={3} activeIndex={2} segmentClassName="min-h-12" />
      </Section>

      <Section title="w-20">
        <Skeleton className="h-12 w-full rounded-full" />
      </Section>
    </SkeletonPage>
  )
}
