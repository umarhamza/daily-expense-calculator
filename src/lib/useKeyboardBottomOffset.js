import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * Tracks on-screen keyboard presence on mobile and computes a bottom offset
 * so bottom sheets can sit above the keyboard. Uses VisualViewport when available.
 *
 * Returns reactive `keyboardOffset` (pixels), `isKeyboardOpen`, and a
 * `sheetStyle` computed style object suitable for binding to a bottom sheet
 * container (adds marginBottom, maxHeight, and paddingBottom).
 */
export function useKeyboardBottomOffset() {
  const keyboardOffset = ref(0)
  const isKeyboardOpen = ref(false)
  const isMobile = ref(false)

  function updateIsMobile() {
    try {
      isMobile.value = window.matchMedia && window.matchMedia('(max-width: 639px)').matches
    } catch (_) {
      isMobile.value = window.innerWidth < 640
    }
  }

  function computeOffset() {
    if (!isMobile.value) {
      keyboardOffset.value = 0
      isKeyboardOpen.value = false
      return
    }
    const vv = window.visualViewport
    if (vv && typeof vv.height === 'number') {
      const bottomInset = Math.max(0, (window.innerHeight - (vv.height + vv.offsetTop)))
      keyboardOffset.value = bottomInset
      isKeyboardOpen.value = bottomInset > 0
      return
    }
    // Fallback: no VisualViewport; leave as zero
    keyboardOffset.value = 0
    isKeyboardOpen.value = false
  }

  const sheetStyle = computed(() => {
    if (!isMobile.value) return {}
    const offset = keyboardOffset.value
    // Add a small breathing space (16px) from top when fully expanded
    const topGapPx = 16
    return {
      marginBottom: offset ? `${offset}px` : '',
      maxHeight: `calc(100dvh - ${offset}px - ${topGapPx}px)`,
      paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${offset}px)`,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }
  })

  function onViewportChange() {
    computeOffset()
  }

  onMounted(() => {
    updateIsMobile()
    computeOffset()
    window.addEventListener('resize', updateIsMobile, { passive: true })
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onViewportChange, { passive: true })
      vv.addEventListener('scroll', onViewportChange, { passive: true })
    } else {
      window.addEventListener('resize', onViewportChange, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateIsMobile)
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
    } else {
      window.removeEventListener('resize', onViewportChange)
    }
  })

  return { keyboardOffset, isKeyboardOpen, sheetStyle }
}

