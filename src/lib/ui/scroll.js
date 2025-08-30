/**
 * Lightweight scroll helpers for chat-style UIs.
 *
 * isElementAtBottom: Returns true if container is within threshold of bottom.
 * scrollToBottom: Imperatively scroll container to the bottom.
 * getScrollAnchors: Capture anchors to preserve visual position across content growth.
 * restoreScrollAnchors: Restore scroll using previously captured anchors.
 * onScroll: Attach a passive scroll listener; returns a cleanup function.
 * onResize: Attach a passive resize listener; returns a cleanup function.
 * observeVisibility: Observe element visibility; returns a cleanup function.
 * rafThrottle: Throttle a function to animation frames.
 * createAutoStick: Track whether user is at bottom and provide destroy method.
 *
 * Inputs: DOM elements and simple options objects.
 * Returns: Plain values or cleanup functions; never throws.
 */

function isElementAtBottom(el, threshold = 32) {
  if (!el) return true;
  const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
  return distance <= Math.max(0, Number(threshold) || 0);
}

function scrollToBottom(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function getScrollAnchors(el) {
  if (!el) return { bottomOffset: 0 };
  const bottomOffset = Math.max(0, el.scrollHeight - (el.scrollTop + el.clientHeight));
  return { bottomOffset };
}

function restoreScrollAnchors(el, anchors) {
  if (!el || !anchors) return;
  const target = el.scrollHeight - el.clientHeight - Math.max(0, anchors.bottomOffset || 0);
  el.scrollTop = Math.max(0, target);
}

function onScroll(el, handler) {
  if (!el || typeof handler !== 'function') return () => {};
  el.addEventListener('scroll', handler, { passive: true });
  return () => el.removeEventListener('scroll', handler);
}

function onResize(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  window.addEventListener('resize', handler, { passive: true });
  return () => window.removeEventListener('resize', handler);
}

function observeVisibility(el, callback, options = { root: null, threshold: 0.01 }) {
  if (!el || typeof IntersectionObserver === 'undefined' || typeof callback !== 'function') return () => {};
  const io = new IntersectionObserver((entries) => {
    const entry = entries[0];
    callback(Boolean(entry && entry.isIntersecting), entry);
  }, options);
  io.observe(el);
  return () => {
    try { io.disconnect(); } catch (_) {}
  };
}

function rafThrottle(fn) {
  if (typeof requestAnimationFrame === 'undefined') return fn;
  let rafId = 0;
  let lastArgs = [];
  return function throttled(...args) {
    lastArgs = args;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      fn.apply(null, lastArgs);
    });
  };
}

function createAutoStick(el, { threshold = 32 } = {}) {
  let atBottom = true;
  const update = () => { atBottom = isElementAtBottom(el, threshold); };
  const destroyScroll = onScroll(el, rafThrottle(update));
  // Initialize
  update();
  return {
    isAtBottom() { return atBottom; },
    scrollToBottom() { scrollToBottom(el); },
    destroy() { destroyScroll(); },
  };
}

export { isElementAtBottom, scrollToBottom, getScrollAnchors, restoreScrollAnchors, onScroll, onResize, observeVisibility, rafThrottle, createAutoStick };

