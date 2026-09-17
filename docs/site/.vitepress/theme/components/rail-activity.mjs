// Keep every CSS timeline on the same clock. Suspending never resets its phase.
export function watchRailActivity(element, onChange, {
  doc = globalThis.document,
  Observer = globalThis.IntersectionObserver,
  matchMedia = globalThis.matchMedia?.bind(globalThis)
} = {}) {
  if (!element || !doc) {
    onChange(false)
    return () => {}
  }
  const media = matchMedia?.('(prefers-reduced-motion: reduce)')
  let visible = !Observer
  let disposed = false
  const update = () => {
    if (!disposed) onChange(visible && !doc.hidden && !media?.matches)
  }
  const observer = Observer ? new Observer(entries => {
    for (const entry of entries) {
      if (entry.target === element) visible = entry.isIntersecting
    }
    update()
  }) : null
  observer?.observe(element)
  doc.addEventListener('visibilitychange', update)
  media?.addEventListener('change', update)
  update()
  return () => {
    disposed = true
    observer?.disconnect()
    doc.removeEventListener('visibilitychange', update)
    media?.removeEventListener('change', update)
  }
}
