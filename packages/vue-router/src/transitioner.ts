import { defineComponent, ref, computed, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import { getLocationChangeInfo, handleHashScroll, RegisteredRouter, trimPathRight } from '@tanstack/router-core'
import { useRouter } from './useRouter'
import { useRouterState } from './useRouterState'
import { usePrevious } from './utils'

export const Transitioner = defineComponent({
  name: 'Transitioner',
  setup() {
    const router = useRouter()

    // When rendering on server, render nothing and skip client-only work
    if (router.isServer) {
      return () => null
    }

    // Local “startTransition” flag
    const isTransitioning = ref(false)

    // Router state selections
    const isLoading = useRouterState<RegisteredRouter, boolean>({
  select: (s) => s.isLoading,
})

    const hasPendingMatches = useRouterState<RegisteredRouter, boolean>({
  select: (s) => s.matches.some((d) => d.status === 'pending'),
})

    // Derived states
    const isAnyPending = computed(() => isLoading.value || isTransitioning.value || hasPendingMatches.value)
    const isPagePending = computed(() => isLoading.value || hasPendingMatches.value)

    // "previous" helpers (to replicate Solid's previousX.previous checks)
    const previousIsAnyPending = usePrevious(() => isAnyPending.value)
    const previousIsPagePending = usePrevious(() => isPagePending.value)
    const previousIsLoading = usePrevious(() => isLoading.value)

    // Expose startTransition on router
    router.startTransition = async (fn: () => void | Promise<void>) => {
      isTransitioning.value = true
      try {
        await fn()
      } finally {
        isTransitioning.value = false
      }
    }

    // Keep track of first mount per router instance (to mirror Solid's mountLoadForRouter)
    let mountLoadForRouter: { router: typeof router; mounted: boolean } = { router, mounted: false }

    // Subscribe to history and commit normalized initial location
    let unsub: (() => void) | undefined

    onMounted(() => {
      unsub = router.history.subscribe(router.load)

      const nextLocation = router.buildLocation({
        to: router.latestLocation.pathname,
        search: true,
        params: true,
        hash: true,
        state: true,
        _includeValidateSearch: true,
      })

      if (trimPathRight(router.latestLocation.href) !== trimPathRight(nextLocation.href)) {
        router.commitLocation({ ...nextLocation, replace: true })
      }
    })

    onBeforeUnmount(() => {
      if (unsub) unsub()
    })

    // Initial load (avoid duplicate loads like in Solid's createRenderEffect + untrack)
    watchEffect(() => {
      // If SSR hydrating, loading happens elsewhere; also guard against duplicate for same router
      if (
        (typeof window !== 'undefined' && router.ssr) ||
        (mountLoadForRouter.router === router && mountLoadForRouter.mounted)
      ) {
        return
      }

      mountLoadForRouter = { router, mounted: true }

      ;(async () => {
        try {
          await router.load()
        } catch (err) {
          // Keep parity with Solid impl
          // eslint-disable-next-line no-console
          console.error(err)
        }
      })()
    })

    // ==== Event emitters matching Solid effects ====

    // onLoad: when was loading, now not
    watch(isLoading, (now, prev) => {
      if (prev && !now) {
        router.emit({
          type: 'onLoad',
          ...getLocationChangeInfo(router.state),
        })
      }
    })

    // onBeforeRouteMount: when page pending → not pending
    watch(isPagePending, (now, prev) => {
      if (prev && !now) {
        router.emit({
          type: 'onBeforeRouteMount',
          ...getLocationChangeInfo(router.state),
        })
      }
    })

    // onResolved + finalize state + hash scroll: when anyPending → not pending
    watch(isAnyPending, (now, prev) => {
      if (prev && !now) {
        router.emit({
          type: 'onResolved',
          ...getLocationChangeInfo(router.state),
        })

        router.__store.setState((s: any) => ({
          ...s,
          status: 'idle',
          resolvedLocation: s.location,
        }))

        handleHashScroll(router)
      }
    })

    // Render nothing (headless)
    return () => null
  },
})
