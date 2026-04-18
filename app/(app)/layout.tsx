import { BottomNav } from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-lg pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
