import {
  ArrowLeftRight,
  BarChart3,
  Home,
  List,
  ListChecks,
  Settings,
  ShoppingBasket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  /** Riga di spiegazione mostrata nel menu (non nella barra in basso). */
  description: string
  icon: LucideIcon
}

/**
 * Tutte le destinazioni dell'app, in un posto solo: il menu dell'header le
 * elenca per intero, la barra in basso ne mostra un sottoinsieme. Tenerle in
 * un unico file evita che le due navigazioni divergano quando si aggiunge una
 * schermata — è già successo con Statistiche e Catalogo faccende.
 */
export const NAV_PRIMARY: NavItem[] = [
  { href: '/', label: 'Home', description: 'Saldo corrente e ultime spese', icon: Home },
  { href: '/spese', label: 'Storico spese', description: 'Tutte le spese, con i filtri', icon: List },
  {
    href: '/lista',
    label: 'Lista della spesa',
    description: 'Cosa manca in casa e controllo scontrino',
    icon: ShoppingBasket,
  },
  {
    href: '/casa',
    label: 'Gestione casa',
    description: 'Faccende e obiettivo della settimana',
    icon: Sparkles,
  },
  {
    href: '/conguaglio',
    label: 'Conguaglio',
    description: 'Chiudi il saldo dopo il bonifico',
    icon: ArrowLeftRight,
  },
]

/** Schermate di consultazione e configurazione: sempre e solo nel menu. */
export const NAV_SECONDARY: NavItem[] = [
  {
    href: '/statistiche',
    label: 'Statistiche',
    description: 'Andamento delle spese di casa',
    icon: BarChart3,
  },
  {
    href: '/casa/catalogo',
    label: 'Catalogo faccende',
    description: 'Aggiungi, ritara o disattiva le voci',
    icon: ListChecks,
  },
  {
    href: '/impostazioni',
    label: 'Impostazioni',
    description: 'Profilo, password, account Telegram',
    icon: Settings,
  },
]

/**
 * Cosa compare nella barra in basso: le quattro schermate che si aprono più
 * volte al giorno. Il conguaglio resta fuori — è l'azione più rara dell'app
 * (`docs/design-modulo-gestione-casa.md § 6`) e vive nel menu insieme alle
 * altre. Quattro voci tengono le etichette leggibili anche a 320px.
 */
export const BOTTOM_NAV_HREFS = ['/', '/spese', '/lista', '/casa']

export const BOTTOM_NAV_ITEMS: NavItem[] = BOTTOM_NAV_HREFS.map(
  (href) => NAV_PRIMARY.find((item) => item.href === href)!,
)

/** Etichetta corta per la barra in basso, dove "Storico spese" non ci sta. */
export const BOTTOM_NAV_LABELS: Record<string, string> = {
  '/': 'Home',
  '/spese': 'Storico',
  '/lista': 'Lista',
  '/casa': 'Casa',
}

/**
 * La voce attiva è quella con l'href più lungo che è prefisso del percorso
 * corrente: così `/casa/catalogo` illumina "Catalogo faccende" e non
 * "Gestione casa".
 */
export function activeNavHref(pathname: string, items: NavItem[]): string | undefined {
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((it) => pathname === it.href || pathname.startsWith(`${it.href}/`))?.href
}
