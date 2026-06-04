import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

export default function GarageLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <Skeleton className="h-7 w-32" />
      {[...Array(2)].map((_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  )
}
