import {
  getBoughtShoppingItems,
  getLastReceiptCheck,
  getMissingSinceLastCheck,
  getOpenShoppingItems,
} from '@/lib/queries'
import { ShoppingShell } from './ShoppingShell'

export default async function ListaPage() {
  const [openItems, boughtItems, lastCheck, missingSinceCheck] = await Promise.all([
    getOpenShoppingItems(),
    getBoughtShoppingItems(20),
    getLastReceiptCheck(),
    getMissingSinceLastCheck(),
  ])

  return (
    <ShoppingShell
      openItems={openItems}
      boughtItems={boughtItems}
      lastCheck={lastCheck}
      missingSinceCheck={missingSinceCheck}
    />
  )
}
