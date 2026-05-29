import { Suspense } from 'react'
import { AssistantChat } from '@/components/AssistantChat'
import { BottomNav } from '@/components/BottomNav'
import { FlashToast } from '@/components/FlashToast'
import { PageTransition } from '@/components/PageTransition'
import { PullToRefresh } from '@/components/PullToRefresh'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-lg pb-[calc(4rem+env(safe-area-inset-bottom))]">
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
