import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ListaLoading() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      <div className="flex items-baseline justify-between px-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
      {Array.from({ length: 2 }).map((_, group) => (
        <Card key={group} className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="size-8 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="mb-1.5 h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
