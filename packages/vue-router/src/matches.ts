// matches.ts (Vue library version)
import * as Vue from 'vue'
import warning from 'tiny-warning'
import { rootRouteId } from '@tanstack/router-core'
import { CatchBoundary, ErrorComponent } from './catchBoundary'
import { useRouterState } from './useRouterState'
import { useRouter } from './useRouter'
import { Transitioner } from './transitioner'
import { matchContext } from './matchContext'
import { SafeFragment } from './safeFragment'
import { Match } from './Match'
import type {
  AnyRoute,
  AnyRouter,
  DeepPartial,
  Expand,
  MakeOptionalPathParams,
  MakeOptionalSearchParams,
  MakeRouteMatchUnion,
  MaskOptions,
  MatchRouteOptions,
  NoInfer,
  RegisteredRouter,
  ResolveRelativePath,
  ResolveRoute,
  RouteByPath,
  RouterState,
  ToSubOptionsProps,
} from '@tanstack/router-core'

declare module '@tanstack/router-core' {
  export interface RouteMatchExtensions {
    meta?: Array<Vue.HTMLAttributes | undefined>
    links?: Array<Vue.HTMLAttributes | undefined>
    scripts?: Array<Vue.HTMLAttributes | undefined>
    styles?: Array<Vue.HTMLAttributes | undefined>
    headScripts?: Array<Vue.HTMLAttributes | undefined>
  }
}

export const Matches = Vue.defineComponent({
  name: 'Matches',
  setup() {
    const router = useRouter()

    // Pick Suspense or a no-op wrapper depending on SSR situation (parity with Solid)
    const ResolvedSuspense =
      router.isServer || (typeof document !== 'undefined' && router.ssr)
        ? SafeFragment
        : (Vue.Suspense as any)

    const rootRoute: () => AnyRoute = () => router.routesById[rootRouteId]
    const PendingComponent =
      rootRoute().options.pendingComponent ?? router.options.defaultPendingComponent

    const OptionalWrapper = router.options.InnerWrap || SafeFragment

    return () =>
      Vue.h(
        OptionalWrapper as any,
        {},
        [
          Vue.h(
            ResolvedSuspense,
            {},
            {
              default: () => [Vue.h(Transitioner), Vue.h(MatchesInner)],
              fallback: () => (PendingComponent ? Vue.h(PendingComponent) : null),
            },
          ),
        ],
      )
  },
})

const MatchesInner = Vue.defineComponent({
  name: 'MatchesInner',
  setup() {
    const router = useRouter()

    const matchId = useRouterState({
      select: (s) => s.matches[0]?.id,
    })

    const resetKey = useRouterState({
      select: (s) => s.loadedAt,
    })

    // Provide current match id to children (parity with Solid matchContext.Provider)
    Vue.provide(matchContext as any, matchId)

    const matchComponent = () =>
      matchId.value ? Vue.h(Match as any, { matchId: matchId.value }) : null

    if (router.options.disableGlobalCatchBoundary) {
      return () => matchComponent()
    }

    return () =>
      Vue.h(
        CatchBoundary as any,
        {
          getResetKey: () => resetKey.value,
          errorComponent: ErrorComponent,
          onCatch: (error: any) => {
            warning(
              false,
              `The following error wasn't caught by any route! At the very least, consider setting an 'errorComponent' in your RootRoute!`,
            )
            warning(false, error?.message || String(error))
          },
        },
        { default: () => matchComponent() },
      )
  },
})

export type UseMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = ToSubOptionsProps<TRouter, TFrom, TTo> &
  DeepPartial<MakeOptionalSearchParams<TRouter, TFrom, TTo>> &
  DeepPartial<MakeOptionalPathParams<TRouter, TFrom, TTo>> &
  MaskOptions<TRouter, TMaskFrom, TMaskTo> &
  MatchRouteOptions

export function useMatchRoute<TRouter extends AnyRouter = RegisteredRouter>() {
  const router = useRouter()
  const status = useRouterState({ select: (s) => s.status })

  // Return a typed factory that yields a ComputedRef with params|false
  return <
    const TFrom extends string = string,
    const TTo extends string | undefined = undefined,
    const TMaskFrom extends string = TFrom,
    const TMaskTo extends string = '',
  >(
    opts: UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
  ): Vue.ComputedRef<
    false | Expand<ResolveRoute<TRouter, TFrom, TTo>['types']['allParams']>
  > => {
    const { pending, caseSensitive, fuzzy, includeSearch, ...rest } = opts

    const matchRoute = Vue.computed(() => {
      status.value
      return router.matchRoute(rest as any, {
        pending,
        caseSensitive,
        fuzzy,
        includeSearch,
      })
    })

    return matchRoute
  }
}

export type MakeMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
  children?:
    | ((
        params?: RouteByPath<
          TRouter['routeTree'],
          ResolveRelativePath<TFrom, NoInfer<TTo>>
        >['types']['allParams'],
      ) => Vue.VNodeChild)
    | Vue.VNodeChild
}

export const MatchRoute = Vue.defineComponent({
  name: 'MatchRoute',
  // We keep props structurally compatible with your Solid version
  props: ['children'] as unknown as undefined,
  setup(props: any, { slots, attrs }) {
    const status = useRouterState({ select: (s) => s.status })
    const makeMatchRoute = useMatchRoute()

    return () => {
      // Trigger reactivity on status like Solid's <Show when={status()} keyed>
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      status.value

      const paramsRef = makeMatchRoute((attrs as any)) // use attrs as the options bag
      const params = paramsRef.value as any

      const childProp = props.children
      const slotChild = slots.default?.()

      if (typeof childProp === 'function') {
        return (childProp as any)(params)
      }

      // Prefer explicit children prop; else use default slot; else null
      const chosen = childProp ?? (slotChild?.length ? slotChild : null)
      return params ? chosen : null
    }
  },
})

export interface UseMatchesBaseOptions<TRouter extends AnyRouter, TSelected> {
  select?: (matches: Array<MakeRouteMatchUnion<TRouter>>) => TSelected
}

export type UseMatchesResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? Array<MakeRouteMatchUnion<TRouter>> : TSelected

export function useMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>> {
  return useRouterState({
    select: (state: RouterState<TRouter['routeTree']>) => {
      const matches = state.matches
      return opts?.select
        ? opts.select(matches as Array<MakeRouteMatchUnion<TRouter>>)
        : (matches as any)
    },
  } as any) as unknown as Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>>
}

export function useParentMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>> {
  // matchContext is provided as a ComputedRef of current match id
  const contextMatchId = Vue.inject(matchContext as any) as Vue.ComputedRef<
    string | undefined
  >

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      const id = contextMatchId?.value
      const pruned = matches.slice(0, matches.findIndex((d) => d.id === id))
      return opts?.select ? opts.select(pruned) : (pruned as any)
    },
  } as any) as unknown as Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>>
}

export function useChildMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>> {
  const contextMatchId = Vue.inject(matchContext as any) as Vue.ComputedRef<
    string | undefined
  >

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      const id = contextMatchId?.value
      const idx = matches.findIndex((d) => d.id === id)
      const pruned = matches.slice(idx + 1)
      return opts?.select ? opts.select(pruned) : (pruned as any)
    },
  } as any) as unknown as Vue.ComputedRef<UseMatchesResult<TRouter, TSelected>>
}
