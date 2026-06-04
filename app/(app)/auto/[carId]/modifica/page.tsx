import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/queries'
import { getCarDetail } from '@/lib/queries-cars'
import { CarForm } from '../../CarForm'

export default async function ModificaAutoPage({
  params,
}: {
  params: Promise<{ carId: string }>
}) {
  const { carId } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const detail = await getCarDetail(carId)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
      <Link
        href={`/auto/${carId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {detail.car.model}
      </Link>
      <h1 className="text-xl font-semibold text-foreground">Modifica auto</h1>
      <CarForm
        currentUserId={user.id}
        car={detail.car}
        photoUrl={detail.photoUrl}
      />
    </div>
  )
}
