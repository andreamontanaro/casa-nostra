import { Skeleton } from '@/components/ui/Skeleton'
import { Card, CardContent } from '@/components/ui/Card'

export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <Skeleton className="h-7 w-36" />

      <Card>
        <CardContent className="py-5 flex flex-col items-center gap-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-52" />
          <div className="flex w-full justify-around pt-1">
            <div className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Card className="divide-y divide-border overflow-hidden p-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
