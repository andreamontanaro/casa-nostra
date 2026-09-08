import { DesktopNav } from '@/components/DesktopNav'
import { Suspense } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { AssistantChat } from '@/components/AssistantChat'
import { BottomNav } from '@/components/BottomNav'
import { FlashToast } from '@/components/FlashToast'
import { PageTransition } from '@/components/PageTransition'
import { PullToRefresh } from '@/components/PullToRefresh'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-surface focus:p-3">Vai al contenuto</a>
      <AppHeader />
      <DesktopNav />
      <main id="main-content" className="mx-auto w-full max-w-lg pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-6xl lg:pl-60 lg:pb-8">
        <PullToRefresh>
          <PageTransition>{children}</PageTransition>
        </PullToRefresh>
      </main>
      <BottomNav />
      <AssistantChat />
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </>
  )
}
