import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from '@/lib/toast'
import './globals.css'

const systemBarLight = '#eaf8f7'
const systemBarDark = '#0a1c1e'

export const metadata: Metadata = {
  title: 'Casa Nostra',
  description: 'Gestione spese condivise',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Casa Nostra',
  },
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
    { media: '(prefers-color-scheme: light)', color: systemBarLight },
    { media: '(prefers-color-scheme: dark)', color: systemBarDark },
  ],
}

const themeInitScript = `(function(){try{var l='${systemBarLight}',d='${systemBarDark}';function r(){var t=localStorage.getItem('theme');if(t==='dark'||t==='light')return t;return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}function u(){var c=r()==='dark'?d:l;var m=document.querySelectorAll('meta[name="theme-color"]');if(!m.length){var n=document.createElement('meta');n.name='theme-color';n.content=c;document.head.appendChild(n);return}m.forEach(function(x){x.setAttribute('content',c);x.removeAttribute('media')})}var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}u();window.addEventListener('casa-nostra-theme-change',u);if(window.matchMedia){var q=window.matchMedia('(prefers-color-scheme: dark)');if(q.addEventListener)q.addEventListener('change',u);else if(q.addListener)q.addListener(u)}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <NextTopLoader color="#0ea5a4" showSpinner={false} height={2} />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
