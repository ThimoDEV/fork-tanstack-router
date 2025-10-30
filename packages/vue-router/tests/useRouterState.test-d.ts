import { expectTypeOf, test } from 'vitest'
import {
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from '../src'
import type { RouterState } from '../src'

const rootRoute = createRootRoute({
  validateSearch: () => ({
    page: 0,
  }),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'invoices',
})

const invoicesIndexRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '/',
})

const invoiceRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '$invoiceId',
  validateSearch: () => ({ page: 0 }),
})

const routeTree = rootRoute.addChildren([
  invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
  indexRoute,
])

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

// 1) Assert the RouterState search type (no need to touch the composable return here)
test('RouterState location.search matches validated type', () => {
  type S = RouterState<DefaultRouter['routeTree']>
  expectTypeOf<S['location']>().toMatchTypeOf<{
    search: { page?: number | undefined }
  }>()
})

// 2) Assert useRouterState options signature (select param typing)
test('useRouterState options accept a correctly typed select', () => {
  // Pull the function type with generics applied
  type UseStateFn = typeof useRouterState<DefaultRouter, { func: () => void }>

  // The first (optional) parameter type
  type Param0 = Parameters<UseStateFn>[0]

  // It should be an options object with an optional `select`
  expectTypeOf<Param0>().toMatchTypeOf<
    | {
        select?: (
          state: RouterState<DefaultRouter['routeTree']>,
        ) => { func: () => void }
      }
    | undefined
  >()
})

// (Optional) If you want to assert the *return* type when select is provided,
// you can do it structurally without depending on Vue's exact Ref type:
test('useRouterState returns a selected value when select is provided (structural check)', () => {
  type Selected = { func: () => void }
  type UseStateFn = typeof useRouterState<DefaultRouter, Selected>
  type Ret = ReturnType<UseStateFn>

  // Do a structural check that the returned type *contains* the selected shape.
  // This works whether Ret is a Ref/ComputedRef<Selected> or the plain Selected,
  // as long as it exposes `func` somewhere in its value.
  // If your composable returns a Ref, this narrows to Ret['value'].
  // Use a conditional to support both patterns without importing Vue types.

  type Unwrap<T> = T extends { value: infer V } ? V : T

  expectTypeOf<Unwrap<Ret>>().toMatchTypeOf<Selected>()
})
