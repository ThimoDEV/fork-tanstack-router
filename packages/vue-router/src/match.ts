import * as Vue from 'vue'
import invariant from 'tiny-invariant'
import warning from 'tiny-warning'
import {
  createControlledPromise,
  getLocationChangeInfo,
  isNotFound,
  isRedirect,
  rootRouteId,
} from '@tanstack/router-core'
import { CatchBoundary, ErrorComponent } from './catchBoundary'
import { useRouterState } from './useRouterState'
import { useRouter } from './useRouter'
import { CatchNotFound } from './not-found'
import { matchContext } from './matchContext'
import { SafeFragment } from './safeFragment'
import { renderRouteNotFound } from './renderRouteNotFound'
import { ScrollRestoration } from './scroll-restoration'
import type { AnyRoute, RootRouteOptions } from '@tanstack/router-core'

// Small utility: await a promise inside Suspense using async setup
const Awaiter = Vue.defineComponent({
  name: 'Awaiter',
  props: {
    get: { type: Function as Vue.PropType<() => Promise<any> | undefined>, required: true },
  },
  async setup(props) {
    // Allow fallback to show for a tick to mirror Solid's createResource behavior
    await new Promise((r) => setTimeout(r, 0))
    const p = props.get?.()
    if (p) await p
    return () => null
  },
})

export const Match = Vue.defineComponent({
  name: 'Match',
  props: {
    matchId: { type: String, required: true },
  },
  setup(props) {
    const router = useRouter()

    const matchState = useRouterState({
      select: (s) => {
        const match = s.matches.find((d) => d.id === props.matchId)
        invariant(
          match,
          `Could not find match for matchId "${props.matchId}". Please file an issue!`,
        )
        return {
          routeId: match.routeId as string,
          ssr: match.ssr,
          _displayPending: match._displayPending,
        }
      },
    })

    const route = Vue.computed<AnyRoute>(() => router.routesById[matchState.value.routeId])

    const PendingComponent = Vue.computed(
      () => route.value.options.pendingComponent ?? router.options.defaultPendingComponent,
    )
    
    const routeErrorComponent = Vue.computed(
      () => route.value.options.errorComponent ?? router.options.defaultErrorComponent,
    )

    const routeOnCatch = Vue.computed(
      () => route.value.options.onCatch ?? router.options.defaultOnCatch,
    )

    const routeNotFoundComponent = Vue.computed(() =>
      route.value.isRoot
        ? (route.value.options.notFoundComponent ??
           router.options.notFoundRoute?.options.component)
        : route.value.options.notFoundComponent,
    )

    const resolvedNoSsr = Vue.computed(
      () => matchState.value.ssr === false || matchState.value.ssr === 'data-only',
    )

    const useSuspense = Vue.computed(() => {
      const wrap = route.value.options.wrapInSuspense
      const hasPending = !!PendingComponent.value
      const hasPreloadish = (route.value.options.errorComponent as any)?.preload || resolvedNoSsr.value
      const allow =
        (!route.value.isRoot || wrap || resolvedNoSsr.value || matchState.value._displayPending) &&
        (wrap ?? hasPending ?? hasPreloadish)
      return !!allow
    })

    const ResolvedCatchBoundary = Vue.computed(() =>
      routeErrorComponent.value ? CatchBoundary : SafeFragment,
    )
    const ResolvedNotFoundBoundary = Vue.computed(() =>
      routeNotFoundComponent.value ? CatchNotFound : SafeFragment,
    )

    const resetKey = useRouterState({ select: (s) => s.loadedAt })

    const parentRouteId = useRouterState({
      select: (s) => {
        const index = s.matches.findIndex((d) => d.id === props.matchId)
        return s.matches[index - 1]?.routeId as string
      },
    })

    const ShellComponent = Vue.computed<any>(() =>
      route.value.isRoot
        ? ((route.value.options as RootRouteOptions).shellComponent ?? SafeFragment)
        : SafeFragment,
    )

    // Provide match id to children (parity with Solid's context.Provider)
    Vue.provide(matchContext as any, Vue.computed(() => props.matchId))

    const contentVNode = () => {
      // Not-found boundary with a fallback handler
      const notFoundChild = Vue.h(
        ResolvedNotFoundBoundary.value as any,
        {
          // Solid used a "fallback={(error)=>...}" prop; keep same contract
          fallback: (error: any) => {
            if (
              !routeNotFoundComponent.value ||
              (error.routeId && error.routeId !== matchState.value.routeId) ||
              (!error.routeId && !route.value.isRoot)
            ) {
              throw error
            }
            return Vue.h(routeNotFoundComponent.value as any, { ...error })
          },
        },
        {
          default: () => {
            // resolvedNoSsr path
            if (resolvedNoSsr.value) {
              if (!router.isServer) {
                return Vue.h(MatchInner as any, { matchId: props.matchId })
              }
              // server + no-ssr: show pending on server to avoid hydration mismatch
              return PendingComponent.value
                ? Vue.h(PendingComponent.value as any)
                : null
            }

            // normal path
            return Vue.h(MatchInner as any, { matchId: props.matchId })
          },
        },
      )

      // Catch boundary
      const catchChild = Vue.h(
        ResolvedCatchBoundary.value as any,
        {
          getResetKey: () => resetKey.value,
          errorComponent: routeErrorComponent.value || ErrorComponent,
          onCatch: (error: Error) => {
            if (isNotFound(error)) throw error
            warning(false, `Error in route match: ${props.matchId}`)
            routeOnCatch.value?.(error)
          },
        },
        { default: () => notFoundChild },
      )

      // Suspense or SafeFragment
      if (useSuspense.value) {
        return Vue.h(
          Vue.Suspense,
          {},
          {
            default: () => catchChild,
            fallback:
              router.isServer || resolvedNoSsr.value
                ? undefined
                : () =>
                    (PendingComponent.value
                      ? Vue.h(PendingComponent.value as any)
                      : null),
          },
        )
      }
      return catchChild
    }

    return () =>
      Vue.h(
        ShellComponent.value as any,
        {},
        [
          contentVNode(),
          parentRouteId.value === rootRouteId
            ? Vue.h(SafeFragment as any, {}, [
                Vue.h(OnRendered),
                Vue.h(ScrollRestoration as any),
              ])
            : null,
        ],
      )
  },
})

// OnRendered: emit 'onRendered' after each render keyed by location state.__TSR_key
const OnRendered = Vue.defineComponent({
  name: 'OnRendered',
  setup() {
    const router = useRouter()
    const locationKey = useRouterState({
      select: (s) => s.resolvedLocation?.state.__TSR_key,
    })

    Vue.watch(
      () => locationKey.value,
      () => {
        router.emit({
          type: 'onRendered',
          ...getLocationChangeInfo(router.state),
        })
      },
      { immediate: true },
    )
    return () => null
  },
})

export const MatchInner = Vue.defineComponent({
  name: 'MatchInner',
  props: {
    matchId: { type: String, required: true },
  },
  setup(props) {
    const router = useRouter()

    const matchState = useRouterState({
      select: (s) => {
        const match = s.matches.find((d) => d.id === props.matchId)!
        const routeId = match.routeId as string

        const remountFn =
          (router.routesById[routeId] as AnyRoute).options.remountDeps ??
          router.options.defaultRemountDeps

        const remountDeps = remountFn?.({
          routeId,
          loaderDeps: match.loaderDeps,
          params: match._strictParams,
          search: match._strictSearch,
        })
        const key = remountDeps ? JSON.stringify(remountDeps) : undefined

        return {
          key,
          routeId,
          match: {
            id: match.id,
            status: match.status,
            error: match.error,
            _forcePending: match._forcePending,
            _displayPending: match._displayPending,
          },
        }
      },
    })

    const route = Vue.computed(
      () => router.routesById[matchState.value.routeId]!,
    )
    const match = Vue.computed(() => matchState.value.match)

    const out = () => {
      const Comp =
        (route.value.options.component as any) ??
        (router.options.defaultComponent as any)
      if (Comp) {
        const key = matchState.value.key ?? matchState.value.match.id
        // Force remount by keying the vnode
        return Vue.h(Comp, { key })
      }
      return Vue.h(Outlet)
    }

    return () => {
      // _displayPending
      if (match.value._displayPending) {
        return Vue.h(Awaiter, {
          get: () => router.getMatch(match.value.id)?._nonReactive.displayPendingPromise,
        })
      }

      // _forcePending
      if (match.value._forcePending) {
        return Vue.h(Awaiter, {
          get: () => router.getMatch(match.value.id)?._nonReactive.minPendingPromise,
        })
      }

      // pending
      if (match.value.status === 'pending') {
        const pendingMinMs =
          (route.value.options as any).pendingMinMs ??
          (router.options as any).defaultPendingMinMs

        if (pendingMinMs) {
          const routerMatch = router.getMatch(match.value.id)
          if (
            routerMatch &&
            !routerMatch._nonReactive.minPendingPromise &&
            !router.isServer
          ) {
            const minPendingPromise = createControlledPromise<void>()
            routerMatch._nonReactive.minPendingPromise = minPendingPromise
            setTimeout(() => {
              minPendingPromise.resolve()
              routerMatch._nonReactive.minPendingPromise = undefined
            }, pendingMinMs)
          }
        }

        return Vue.h(Awaiter, {
          get: async () => {
            await new Promise((r) => setTimeout(r, 0))
            return router.getMatch(match.value.id)?._nonReactive.loadPromise
          },
        })
      }

      // notFound
      if (match.value.status === 'notFound') {
        invariant(isNotFound(match.value.error), 'Expected a notFound error')
        return renderRouteNotFound(router, route.value, match.value.error)
      }

      // redirected
      if (match.value.status === 'redirected') {
        return Vue.h(Awaiter, {
          get: async () => {
            await new Promise((r) => setTimeout(r, 0))
            return router.getMatch(match.value.id)?._nonReactive.loadPromise
          },
        })
      }

      // error
      if (match.value.status === 'error') {
        if (router.isServer) {
          const RouteErrorComponent =
            (route.value.options.errorComponent ??
              router.options.defaultErrorComponent) || ErrorComponent
          return Vue.h(RouteErrorComponent as any, {
            error: match.value.error,
            info: { componentStack: '' },
          })
        }
        throw match.value.error
      }

      // success
      return out()
    }
  },
})

export const Outlet = Vue.defineComponent({
  name: 'Outlet',
  setup() {
    const router = useRouter()
    const matchIdRef = Vue.inject(matchContext as any) as Vue.ComputedRef<
      string | undefined
    >

    const routeId = useRouterState({
      select: (s) =>
        s.matches.find((d) => d.id === matchIdRef?.value)?.routeId as string,
    })

    const route = Vue.computed<AnyRoute>(() => router.routesById[routeId.value]!)

    const parentGlobalNotFound = useRouterState({
      select: (s) => {
        const matches = s.matches
        const parentMatch = matches.find((d) => d.id === matchIdRef?.value)
        invariant(
          parentMatch,
          `Could not find parent match for matchId "${matchIdRef?.value}"`,
        )
        return parentMatch.globalNotFound
      },
    })

    const childMatchId = useRouterState({
      select: (s) => {
        const matches = s.matches
        const index = matches.findIndex((d) => d.id === matchIdRef?.value)
        return matches[index + 1]?.id as string | undefined
      },
    })

    return () => {
      if (parentGlobalNotFound.value) {
        return renderRouteNotFound(router, route.value, undefined)
      }

      const childId = childMatchId.value
      if (!childId) return null

      // If next match is root, wrap in Suspense with fallback; else render directly
      if (childId === rootRouteId) {
        const fallback =
          router.options.defaultPendingComponent
            ? Vue.h(router.options.defaultPendingComponent as any)
            : null
        return Vue.h(
          Vue.Suspense,
          {},
          {
            default: () => Vue.h(Match as any, { matchId: childId }),
            fallback: () => fallback,
          },
        )
      }

      return Vue.h(Match as any, { matchId: childId })
    }
  },
})
