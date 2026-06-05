'use client'

import { usePathname } from 'next/navigation'
import { AssistantChat } from './AssistantChat'

/**
 * L'assistente IA è tarato sulle spese condivise: lo nascondiamo nel modulo
 * "Le mie auto" per non dare contesto fuorviante.
 */
export function AssistantChatGate() {
  return <AssistantChat />
}
