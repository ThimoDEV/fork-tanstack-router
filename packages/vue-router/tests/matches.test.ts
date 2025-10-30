import { afterEach, expect, test, vi, describe } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { h, defineComponent, provide, inject } from 'vue'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  isMatch,
  useMatches,
} from '../src'
import { sleep } from './utils'

const WAIT_TIME = 100

afterEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => h(Link as any, { to: '/invoices/' }, 'To Invoices'),
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'invoices',
  loader: () => [{ id: '1' }, { id: '2' }],
  component: () => h(Outlet),
})

const InvoicesIndex = () => {
  const matches = useMatches<DefaultRouter>()

  const loaderDataMatches = matches.value.filter((match) =>
    isMatch(match, 'loaderData.0.id'),
  )

  const contextMatches = matches.value.filter((match) =>
    isMatch(match, 'context.permissions'),
  )

  const incorrectMatches = matches.value.filter((match) =>
    isMatch(match, 'loaderData.6.id'),
  )

  return h('div', [
    h('section', `Loader Matches - ${loaderDataMatches.map((m) => m.fullPath).join(',')}`),
    h('section', `Context Matches - ${contextMatches.map((m) => m.fullPath).join(',')}`),
    h('section', `Incorrect Matches - ${incorrectMatches.map((m) => m.fullPath).join(',')}`),
  ])
}

const invoicesIndexRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '/',
  component: InvoicesIndex,
  context: () => ({
    permissions: 'permission',
  }),
})

const invoiceRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '$invoiceId',
  validateSearch: () => ({ page: 0 }),
})

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
})

const commentsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'comments/$id',
  validateSearch: () => ({
    page: 0,
    search: '',
  }),
  loader: () => [{ comment: 'one comment' }, { comment: 'two comment' }] as const,
})

const routeTree = rootRoute.addChildren([
  invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
  indexRoute,
  layoutRoute.addChildren([commentsRoute]),
])

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

test('when filtering useMatches by loaderData', async () => {
  render(() => h(RouterProvider as any, { router: defaultRouter }))

  const searchLink = await screen.findByRole('link', { name: 'To Invoices' })

  fireEvent.click(searchLink)

  expect(await screen.findByText('Loader Matches - /invoices')).toBeInTheDocument()

  expect(await screen.findByText('Context Matches - /invoices/')).toBeInTheDocument()

  expect(await screen.findByText('Incorrect Matches -')).toBeInTheDocument()
})

test('Matches provides InnerWrap context to route components', async () => {
  const INJECTION = Symbol('test-injection')

  const root = createRootRoute({
    component: () => {
      const contextValue = inject(INJECTION)
      expect(contextValue, 'Context is not provided').not.toBeUndefined()
      return h('div', String(contextValue))
    },
  })

  const tree = root.addChildren([])
  const router = createRouter({ routeTree: tree })

  const InnerWrap = defineComponent({
    setup(_, { slots }) {
      provide(INJECTION, 'context-for-children')
      return () => (slots.default ? slots.default() : null)
    },
  })

  render(() => h(RouterProvider as any, { router, InnerWrap }))

  const indexElem = await screen.findByText('context-for-children')
  expect(indexElem).toBeInTheDocument()
})

test('Matches provides InnerWrap context to defaultPendingComponent', async () => {
  const root = createRootRoute({})
  const indexRoute = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => h('div', [h(Link as any, { to: '/home' }, 'link to home')]),
  })

  const homeRoute = createRoute({
    getParentRoute: () => root,
    path: '/home',
    loader: () => sleep(300),
    component: () => h('div', 'Home page'),
  })

  const tree = root.addChildren([homeRoute, indexRoute])
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  const INJECTION = Symbol('default-pending-injection')

  const DefaultPending = () => {
    const contextValue = inject(INJECTION)
    expect(contextValue, 'Context is not provided').not.toBeUndefined()
    return h('div', String(contextValue))
  }

  const InnerWrap = (_props: any, { slots }: any) => {
    provide(INJECTION, 'context-for-default-pending')
    return slots?.default?.() ?? null
  }

  render(() =>
    h(RouterProvider as any, {
      router,
      defaultPendingMs: 200,
      defaultPendingComponent: DefaultPending,
      InnerWrap,
    }),
  )

  const linkToHome = await screen.findByRole('link', { name: 'link to home' })
  expect(linkToHome).toBeInTheDocument()

  fireEvent.click(linkToHome)

  const indexElem = await screen.findByText('context-for-default-pending')
  expect(indexElem).toBeInTheDocument()
})

test('should show pendingComponent of root route', async () => {
  const root = createRootRoute({
    pendingComponent: () => h('div', { 'data-testId': 'root-pending' }),
    loader: async () => {
      await new Promise((r) => setTimeout(r, 50))
    },
    component: () => h('div', { 'data-testId': 'root-content' }),
  })

  const router = createRouter({
    routeTree: root,
    defaultPendingMs: 0,
  defaultPendingComponent: () => h('div', 'default pending...'),
  })

  render(() => h(RouterProvider as any, { router }))

  expect(await screen.findByTestId('root-pending')).toBeInTheDocument()
  expect(await screen.findByTestId('root-content')).toBeInTheDocument()
})
