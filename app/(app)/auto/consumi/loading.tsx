import { Skeleton } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

export default function ConsumiLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <Skeleton className="h-7 w-32" />
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
