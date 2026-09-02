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
      <AppHeader />
      <main className="mx-auto w-full max-w-lg pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
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
