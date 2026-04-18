import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/lib/toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Casa Nostra',
  description: 'Gestione spese condivise',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Casa Nostra' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
