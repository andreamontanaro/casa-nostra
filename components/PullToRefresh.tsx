'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 70
const MAX_PULL = 110

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  useEffect(() => {
    // Solo su touch device
    if (!window.matchMedia('(pointer: coarse)').matches) return

    function isInsideHorizontalScroller(target: EventTarget | null): boolean {
      let el = target as HTMLElement | null
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth) {
          const overflowX = getComputedStyle(el).overflowX
          if (overflowX === 'auto' || overflowX === 'scroll') return true
        }
        el = el.parentElement
      }
      return false
    }

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) {
        startY.current = null
        return
      }
      // Se il tocco parte dentro uno scroller orizzontale (es. chip filtri),
      // non intercettare: lasciamo che il browser gestisca lo scroll laterale.
      if (isInsideHorizontalScroller(e.target)) {
        startY.current = null
        return
      }
      startY.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY <= 0) {
        pulling.current = true
        const damped = Math.min(MAX_PULL, dy * 0.5)
        setPull(damped)
      }
    }

    async function onTouchEnd() {
      if (!pulling.current) {
        startY.current = null
        return
      }
      pulling.current = false
      const shouldRefresh = pull >= THRESHOLD
      if (shouldRefresh) {
        setRefreshing(true)
        setPull(THRESHOLD)
        try {
          await new Promise((r) => setTimeout(r, 250))
          router.refresh()
        } finally {
          setTimeout(() => {
            setRefreshing(false)
            setPull(0)
          }, 600)
        }
      } else {
        setPull(0)
      }
      startY.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [pull, refreshing, router])

  const progress = Math.min(1, pull / THRESHOLD)
  const showIndicator = pull > 4 || refreshing

  return (
    <>
      {showIndicator && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center"
          style={{ paddingTop: `calc(env(safe-area-inset-top) + ${pull * 0.5}px)` }}
        >
          <motion.div
            initial={false}
            animate={{ scale: 0.6 + progress * 0.4, opacity: 0.4 + progress * 0.6 }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface shadow-card"
          >
            <RefreshCw
              className={refreshing ? 'size-4 animate-spin text-accent' : 'size-4 text-muted'}
              style={!refreshing ? { transform: `rotate(${progress * 270}deg)` } : undefined}
              strokeWidth={2.5}
            />
          </motion.div>
        </div>
      )}
      <motion.div
        animate={{ y: refreshing ? 24 : pull * 0.4 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {children}
      </motion.div>
    </>
  )
}
