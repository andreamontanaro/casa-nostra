import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

export default function RifornimentiLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <Skeleton className="h-7 w-40" />
      {[...Array(2)].map((_, g) => (
        <div key={g} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Card className="divide-y divide-border overflow-hidden p-0">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}
