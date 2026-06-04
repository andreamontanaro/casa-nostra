import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCarsLite, getFuelEntryById } from '@/lib/queries-cars'
import { FuelEntryForm } from '../FuelEntryForm'

export default async function FuelEntryDetailPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  const { entryId } = await params
  const [entry, cars] = await Promise.all([
    getFuelEntryById(entryId),
    getCarsLite(),
  ])
  if (!entry) notFound()

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
      <Link
        href="/auto/rifornimenti"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Rifornimenti
      </Link>
      <h1 className="text-xl font-semibold text-foreground">Modifica rifornimento</h1>
      <FuelEntryForm cars={cars} entry={entry} />
    </div>
  )
}
