import { getChoreTemplates } from '@/lib/queries'
import { CatalogoClient } from './CatalogoClient'

export default async function CatalogoPage() {
  const templates = await getChoreTemplates()
  return <CatalogoClient templates={templates} />
}
