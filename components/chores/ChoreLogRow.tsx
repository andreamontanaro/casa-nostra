import { ChoreIcon } from '@/components/ChoreIcon'
import { ListRow } from '@/components/ui/ListRow'

interface ChoreLogRowProps {
  area: string
  title: string
  doneByName: string
  whenLabel: string
}

/** Riga del feed "Fatto di recente": chi ha fatto cosa e quando. */
export function ChoreLogRow({ area, title, doneByName, whenLabel }: ChoreLogRowProps) {
  return (
    <ListRow
      leading={<ChoreIcon area={area} size="sm" />}
      title={title}
      subtitle={`${doneByName} · ${whenLabel}`}
    />
  )
}
