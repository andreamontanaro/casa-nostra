import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCarsLite } from '@/lib/queries-cars'
import { FuelEntryForm } from '../FuelEntryForm'

export default async function NuovoRifornimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>
}) {
  const cars = await getCarsLite()
  if (cars.length === 0) redirect('/auto/nuova')

  const { car } = await searchParams

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
      <Link
        href="/auto/rifornimenti"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Rifornimenti
      </Link>
      <h1 className="text-xl font-semibold text-foreground">Nuovo rifornimento</h1>
      <FuelEntryForm cars={cars} defaultCarId={car} />
    </div>
  )
}
