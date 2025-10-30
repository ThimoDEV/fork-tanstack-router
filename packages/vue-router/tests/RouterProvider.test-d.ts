import { expectTypeOf, test } from 'vitest'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'

const rootRoute = createRootRoute()

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

// --- Helper to extract $props from a Vue component ---
type PropsOf<C> = C extends new (...args: any) => { $props: infer P } ? P : never
type RouterProviderProps = PropsOf<typeof RouterProvider>

test('RouterProvider props accept the default router', () => {
  // The component should accept { router, routeTree? } with our DefaultRouter
  expectTypeOf<RouterProviderProps>().toMatchTypeOf<{
    router: DefaultRouter
    routeTree?: DefaultRouter['routeTree']
  }>()
})

test('a concrete props object with our router is valid', () => {
  const propsOk: RouterProviderProps = {
    router: defaultRouter,
    // routeTree is optional, but if provided it must be the same as defaultRouter['routeTree']
    // routeTree,
  }
  expectTypeOf(propsOk.router).toMatchTypeOf<DefaultRouter>()
})
