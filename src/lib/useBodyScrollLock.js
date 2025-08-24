import { watch, unref, onBeforeUnmount } from 'vue'

/**
 * Locks body scroll when `active` is truthy. Preserves prior inline styles.
 * Accepts a Ref or getter returning a boolean.
 */
export function useBodyScrollLock(active) {
  const previous = {
    overflow: '',
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
  }
  let scrollY = 0

  function lock() {
    if (document.body.style.overflow === 'hidden') return
    previous.overflow = document.body.style.overflow
    previous.position = document.body.style.position
    previous.top = document.body.style.top
    previous.left = document.body.style.left
    previous.right = document.body.style.right
    previous.width = document.body.style.width

    scrollY = window.scrollY || window.pageYOffset || 0
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
  }

  function unlock() {
    document.body.style.overflow = previous.overflow
    document.body.style.position = previous.position
    document.body.style.top = previous.top
    document.body.style.left = previous.left
    document.body.style.right = previous.right
    document.body.style.width = previous.width
    window.scrollTo(0, scrollY)
  }

  watch(() => Boolean(unref(active)), (enabled) => {
    if (enabled) lock(); else unlock()
  }, { immediate: true })

  onBeforeUnmount(() => unlock())
}

