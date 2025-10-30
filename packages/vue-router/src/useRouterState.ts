/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterState,
} from '@tanstack/router-core'
import type { ComputedRef } from 'vue'

// Deep equality check to match behavior of solid-store 0.7.0's reconcile()
function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }

  return true
}

export type UseRouterStateOptions<TRouter extends AnyRouter, TSelected> = {
  router?: TRouter
  select?: (state: RouterState<TRouter['routeTree']>) => TSelected
}

export type UseRouterStateResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? RouterState<TRouter['routeTree']> : TSelected

export function useRouterState<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseRouterStateOptions<TRouter, TSelected>,
): ComputedRef<UseRouterStateResult<TRouter, TSelected>> {
  const contextRouter = useRouter<TRouter>({
    warn: opts?.router === undefined,
  })
  const router = opts?.router || contextRouter

  return useStore(
    router.__store,
    (state) => {
      if (opts?.select) return opts.select(state)

      return state
    },
    {
      // Use deep equality to match behavior of solid-store 0.7.0 which used
      // reconcile(). This ensures updates work correctly when selectors
      // return new object references but with the same values.
      equal: deepEqual,
    },
  ) as ComputedRef<UseRouterStateResult<TRouter, TSelected>>
}
