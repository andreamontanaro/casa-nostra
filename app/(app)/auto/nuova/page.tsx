import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/queries'
import { CarForm } from '../CarForm'

export default async function NuovaAutoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
      <Link
        href="/auto"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Garage
      </Link>
      <h1 className="text-xl font-semibold text-foreground">Nuova auto</h1>
      <CarForm currentUserId={user.id} />
    </div>
  )
}
