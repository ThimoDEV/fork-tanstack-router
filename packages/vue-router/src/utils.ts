import {
  computed,
  onBeforeUnmount,
  shallowRef,
  watch,
  watchEffect,
  watchPostEffect,
  type ComputedRef,
  type Ref,
} from 'vue'


export const useLayoutEffect =
  typeof window !== 'undefined' ? watchPostEffect : watchEffect

export const usePrevious = (fn: () => boolean) =>  {
  let prev = { current: null as boolean | null, previous: null as boolean | null }

  return computed(() => {
    const current = fn()
    if (prev.current !== current) {
      prev = { previous: prev.current, current }
    }
    return prev
  })
}

/**
 * Vue composable for react `IntersectionObserver` equivalent.
 * This composable will create an `IntersectionObserver` and observe the ref passed to it.
 * When the intersection changes, the callback will be called with the `IntersectionObserverEntry`.
 * @param ref - The ref to observe
 * @param intersectionObserverOptions - The options to pass to the IntersectionObserver
 * @param options - The options to pass to the composable
 * @param callback - The callback to call when the intersection changes
 * @returns The IntersectionObserver instance
 * @example
 * ```
 */
export function useIntersectionObserver<T extends Element>(
  elRef: Ref<T | null>,
  callback: (entry: IntersectionObserverEntry | undefined) => void,
  intersectionObserverOptions: IntersectionObserverInit = {},
  options: { disabled?: boolean } = {},
): Readonly<Ref<IntersectionObserver | null>> {
  const hasIO =
    typeof window !== 'undefined' && typeof (window as any).IntersectionObserver === 'function'

  const observerRef = shallowRef<IntersectionObserver | null>(null)

  // Create/teardown observer whenever element or disabled flag changes
  const stop = watch(
    [elRef, () => options.disabled, () => hasIO],
    ([el, disabled, available], _, onInvalidate) => {
      // cleanup any previous observer first
      if (observerRef.value) {
        observerRef.value.disconnect()
        observerRef.value = null
      }

      if (!available || disabled || !el) return

      const observer = new IntersectionObserver(([entry]) => {
        callback(entry)
      }, intersectionObserverOptions)

      observer.observe(el)
      observerRef.value = observer

      // ensure cleanup if this watcher invalidates
      onInvalidate(() => {
        observer.disconnect()
        if (observerRef.value === observer) observerRef.value = null
      })
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stop()
    if (observerRef.value) {
      observerRef.value.disconnect()
      observerRef.value = null
    }
  })

  return observerRef
}
