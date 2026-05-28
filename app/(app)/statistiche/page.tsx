import { getAllExpenses, getAllSettlements } from '@/lib/queries'
import { StatisticheClient } from './StatisticheClient'

export default async function StatistichePage() {
  const [expenses, settlements] = await Promise.all([
    getAllExpenses(),
    getAllSettlements(),
  ])

  return <StatisticheClient expenses={expenses} settlements={settlements} />
}
