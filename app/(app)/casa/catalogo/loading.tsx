import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CatalogoLoading() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g}>
          <Skeleton className="mb-3 h-4 w-24" />
          <Card className="divide-y divide-border overflow-hidden p-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="mb-1.5 h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}
