import { Skeleton } from '@/components/ui/Skeleton'
import { Card, CardContent } from '@/components/ui/Card'

export default function NuovaSpesaLoading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <Skeleton className="h-7 w-36" />

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          {/* Importo */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
          {/* Descrizione */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          {/* Categoria chips */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <div className="flex flex-wrap gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))}
            </div>
          </div>
          {/* Divisione chips */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  )
}
