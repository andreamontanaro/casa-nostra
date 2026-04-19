import { Skeleton } from '@/components/ui/Skeleton'
import { Card, CardContent } from '@/components/ui/Card'

export default function ConguaglioLoading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-6">
      <Skeleton className="h-7 w-32" />

      <Card>
        <CardContent className="py-5 flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>
      </Card>

      <section>
        <Skeleton className="h-4 w-44 mb-2" />
        <Card className="divide-y divide-border overflow-hidden p-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
