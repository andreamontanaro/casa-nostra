import { SharedDataRefresh } from '@/components/SharedDataRefresh'
import { DesktopNav } from '@/components/DesktopNav'
import { Suspense } from 'react'
import { AppMenu } from '@/components/AppMenu'
import { AssistantChat } from '@/components/AssistantChat'
import { BottomNav } from '@/components/BottomNav'
import { DisplayNameProvider } from '@/components/HeaderActions'
import { FlashToast } from '@/components/FlashToast'
import { PageTransition } from '@/components/PageTransition'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ShareTargetWorker } from '@/components/ShareTargetWorker'
import { getMyDisplayName } from '@/lib/queries'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Senza `await`: l'iniziale sul bottone del menu arriva quando arriva.
  const displayName = getMyDisplayName()
  return (
    <DisplayNameProvider name={displayName}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-surface focus:p-3">Vai al contenuto</a>
      {/* Niente top bar: titolo, assistente e menu stanno in cima a ogni pagina
          (`HeaderActions`). Resta solo un velo sotto la barra di stato, dove
          c'è la tacca, perché il contenuto non ci scorra dietro scoperto. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-background/95 backdrop-blur-md" />
      <AppMenu />
      <DesktopNav />
      <main id="main-content" className="mx-auto w-full max-w-lg pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-6xl lg:pl-60 lg:pb-8">
        <SharedDataRefresh />
        <PullToRefresh>
          <PageTransition>{children}</PageTransition>
        </PullToRefresh>
      </main>
      <BottomNav />
      <AssistantChat />
      <ShareTargetWorker />
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </DisplayNameProvider>
  )
}
