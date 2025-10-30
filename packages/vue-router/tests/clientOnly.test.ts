import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/vue'
import { h } from 'vue'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import { ClientOnly } from '../src/clientOnly'
import type { RouterHistory } from '../src'

afterEach(() => {
  vi.resetAllMocks()
  cleanup()
})

function createTestRouter(initialHistory?: RouterHistory) {
  const history = initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: (props?: any) =>
      h('div', [
        h('p', 'Index Route'),
        h(
          ClientOnly,
          { fallback: h('div', { 'data-testid': 'loading' }, 'Loading...') },
          h('div', { 'data-testid': 'client-only-content' }, 'Client Only Content'),
        ),
      ]),
  })

  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: (props?: any) => h('div', [h('h1', 'Other')]),
  })

  const routeTree = rootRoute.addChildren([indexRoute, otherRoute])
  const router = createRouter({ routeTree, history })

  return {
    router,
    routes: { indexRoute, otherRoute },
  }
}

describe('ClientOnly (Vue)', () => {
  beforeEach(() => {
    // some codepaths use scrollTo on navigation; stub it
    window.scrollTo = vi.fn()
  })

  // Clear mocks after each test to prevent interference
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render client content after hydration', async () => {
    const { router } = createTestRouter()
    await router.load()

    // Render the RouterProvider with the prepared router
    render(RouterProvider as any, { props: { router } })

    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
  })

  it('should handle navigation with client-only content', async () => {
    const { router } = createTestRouter()
    await router.load()

    // Render the RouterProvider after load (hydration simulated)
    render(RouterProvider as any, { props: { router } })

    // Content should be visible before navigation
    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()

    // Navigate to a different route and back
    await router.navigate({ to: '/other' })
    await router.navigate({ to: '/' })

    // Content should still be visible after navigation
    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()
  })
})
