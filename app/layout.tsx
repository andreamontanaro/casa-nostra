import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from '@/lib/toast'
import { MotionProvider } from '@/components/MotionProvider'
import { KeyboardInsets } from '@/components/KeyboardInsets'
import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/theme'
import './globals.css'

// Font locali: nessuna richiesta esterna durante build o navigazione.
// Evita il fetch build-time da Google Fonts (che su alcuni ambienti Windows
// fa crashare Node nello store certificati) e garantisce build riproducibili.
const manrope = localFont({
  src: './fonts/manrope.woff2',
  display: 'swap',
  variable: '--font-manrope',
  weight: '200 800',
  style: 'normal',
})

const fraunces = localFont({
  src: './fonts/fraunces.woff2',
  display: 'swap',
  variable: '--font-fraunces',
  weight: '100 900',
  style: 'normal',
})

export const metadata: Metadata = {
  title: 'Casa Nostra',
  description: 'Gestione spese condivise',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Casa Nostra' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    // iOS non usa un apple-touch-icon SVG: serve un PNG pieno, senza
    // trasparenza (generato da scripts/generate-icons.mjs).
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android/Chrome: la tastiera accorcia il layout viewport, così le barre in
  // fondo e i campi restano sopra di essa senza calcoli. iOS lo ignora: lì ci
  // pensa <KeyboardInsets> con --keyboard-inset.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR_DARK },
  ],
}

// Tema e accento scelti si applicano prima del primo paint, niente lampo di
// menta chiara. Gli accenti validi vengono da `lib/theme.ts`: un valore
// sconosciuto in localStorage (accento rimosso) ricade sulla menta.
const ALT_ACCENTS = JSON.stringify(ACCENTS.map((a) => a.id).filter((id) => id !== DEFAULT_ACCENT))
const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){d.setAttribute('data-theme',t);}var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');if(${ALT_ACCENTS}.indexOf(a)>=0){d.setAttribute('data-accent',a);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning`: data-theme e data-accent li scrive lo script
    // qui sotto prima dell'idratazione, quindi non sono nell'HTML del server.
    // Vale solo per gli attributi di <html>, non per i figli.
    <html lang="it" className={`h-full ${manrope.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <NextTopLoader color="var(--accent)" showSpinner={false} height={2} />
        <KeyboardInsets />
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  )
}
