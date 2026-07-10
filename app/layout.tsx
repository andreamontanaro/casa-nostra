import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from '@/lib/toast'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/theme'
import './globals.css'

// Inter self-hostato come file locale (variable, range 100–900).
// Evita il fetch build-time da Google Fonts (che su alcuni ambienti Windows
// fa crashare Node nello store certificati) e garantisce build riproducibili.
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  display: 'swap',
  variable: '--font-inter',
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
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR_DARK },
  ],
}

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`h-full ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <NextTopLoader color="var(--accent)" showSpinner={false} height={2} />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
