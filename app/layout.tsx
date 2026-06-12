import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from '@/lib/toast'
import './globals.css'

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
    { media: '(prefers-color-scheme: light)', color: '#f4faf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1514' },
  ],
}

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <NextTopLoader color="#00756d" showSpinner={false} height={2} />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
