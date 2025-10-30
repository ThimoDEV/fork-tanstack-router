import { describe, expect, it, vi } from 'vitest'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '../../src'

describe('Transitioner (server)', () => {
  it('should call router.load() only once when on the server', async () => {
    const loader = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => h('div', null, 'Index'),
      loader,
    })

    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      isServer: true,
    })

    // Mock router.load() to verify it gets called
    const loadSpy = vi.spyOn(router, 'load')

    await router.load()

    const app = createSSRApp({ render: () => h(RouterProvider as any, { router }) })
    await renderToString(app)

    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledTimes(1)

    loadSpy.mockRestore()
  })
})
