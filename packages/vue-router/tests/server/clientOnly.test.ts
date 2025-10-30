import { describe, expect, it } from 'vitest'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  ClientOnly,
} from '../../src'

function createTestRouter(initialHistory?: any) {
  const history =
    initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () =>
      h('div', null, [
        h('p', null, 'Index Route'),
        h(
          ClientOnly as any,
          { fallback: h('div', { 'data-testid': 'loading' }, 'Loading...') },
          {
            default: () => h('div', { 'data-testid': 'client-only-content' }, 'Client Only Content'),
          },
        ),
      ]),
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({ routeTree, history })

  return {
    router,
    routes: { indexRoute },
  }
}

describe('ClientOnly (server)', () => {
  it('should render fallback during SSR', async () => {
    const { router } = createTestRouter()
    await router.load()

    // Initial render (SSR)
    const app = createSSRApp({ render: () => h(RouterProvider as any, { router }) })
    const html = await renderToString(app)

    expect(html).toContain('Loading...')
    expect(html).not.toContain('Client Only Content')
  })
})
