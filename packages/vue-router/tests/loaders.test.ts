import { cleanup, fireEvent, render, screen } from '@testing-library/vue'

import { afterEach, describe, expect, test, vi } from 'vitest'
import { h } from 'vue'

import { z } from 'zod'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouter,
} from '../src'

import { sleep } from './utils'

afterEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

const WAIT_TIME = 100

describe('loaders are being called', () => {
  test('called on /', async () => {
    const indexLoaderMock = vi.fn()

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        await sleep(WAIT_TIME)
        indexLoaderMock('foo')
      },
      component: () => h('div', 'Index page'),
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))

  const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/')
    expect(window.location.pathname).toBe('/')

    expect(indexLoaderMock).toHaveBeenCalled()
  })

  test('both are called on /nested/foo', async () => {
    const nestedLoaderMock = vi.fn()
    const nestedFooLoaderMock = vi.fn()

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () =>
        h('div', [h('h1', 'Index page'), h(Link, { to: '/nested/foo' }, () => 'link to foo')]),
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      loader: async () => {
        await sleep(WAIT_TIME)
        nestedLoaderMock('nested')
      },
    })
    const fooRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/foo',
      loader: async () => {
        await sleep(WAIT_TIME)
        nestedFooLoaderMock('foo')
      },
      component: () => h('div', 'Nested Foo page'),
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([fooRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))

  const linkToAbout = await screen.findByText('link to foo')
  fireEvent.click(linkToAbout)

    const fooElement = await screen.findByText('Nested Foo page')
    expect(fooElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/foo')
    expect(window.location.pathname).toBe('/nested/foo')

    expect(nestedLoaderMock).toHaveBeenCalled()
    expect(nestedFooLoaderMock).toHaveBeenCalled()
  })
})

describe('loaders parentMatchPromise', () => {
  test('parentMatchPromise is defined in a child route', async () => {
    const nestedLoaderMock = vi.fn()

    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => h('div', ['Index page', h(Link, { to: '/nested/foo' }, () => 'link to foo')]),
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      loader: async () => {
        await sleep(WAIT_TIME)
        return 'nested'
      },
      component: () => h(Outlet),
    })
    const fooRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/foo',
      loader: async ({ parentMatchPromise }) => {
        nestedLoaderMock(parentMatchPromise)
        const parentMatch = await parentMatchPromise
        expect(parentMatch.loaderData).toBe('nested')
      },
      component: () => h('div', 'Nested Foo page'),
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([fooRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))

    const linkToFoo = await screen.findByRole('link', { name: 'link to foo' })

    expect(linkToFoo).toBeInTheDocument()

    fireEvent.click(linkToFoo)

    const fooElement = await screen.findByText('Nested Foo page')
    expect(fooElement).toBeInTheDocument()

    expect(nestedLoaderMock).toHaveBeenCalled()
    expect(nestedLoaderMock.mock.calls[0]?.[0]).toBeInstanceOf(Promise)
  })
})

test('reproducer for #2031', async () => {
  const rootRoute = createRootRoute({
    beforeLoad: () => {
      console.log('beforeload called')
    },
  })

  const searchSchema = z.object({
    data: z.string().array().default([]),
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => h('div', 'Index page'),

    validateSearch: searchSchema,
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))

  const indexElement = await screen.findByText('Index page')
  expect(indexElement).toBeInTheDocument()
})

test('reproducer for #2053', async () => {
  const rootRoute = createRootRoute({
    beforeLoad: () => {
      console.log('beforeload called')
    },
  })

  const fooRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/foo/$fooId',
    component: () => {
      const params = fooRoute.useParams()
      return h('div', `fooId: ${params.value.fooId}`)
    },
  })

  window.history.replaceState(null, 'root', '/foo/3ΚΑΠΠΑ')

  const routeTree = rootRoute.addChildren([fooRoute])

  const router = createRouter({
    routeTree,
  })

  render(() => h(RouterProvider, { router }))

  const fooElement = await screen.findByText('fooId: 3ΚΑΠΠΑ')
  expect(fooElement).toBeInTheDocument()
})

test('reproducer for #2198 - throw error from beforeLoad upon initial load', async () => {
  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => h('div', 'Index page'),
    beforeLoad: () => {
      throw new Error('Test!')
    },
    errorComponent: () => h('div', 'indexErrorComponent'),
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({
    routeTree,
    defaultErrorComponent: () => h('div', 'defaultErrorComponent'),
  })

  render(() => h(RouterProvider, { router }))

  const errorElement = await screen.findByText('indexErrorComponent')
  expect(errorElement).toBeInTheDocument()
})

test('throw error from loader upon initial load', async () => {
  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => h('div', 'Index page'),
    loader: () => {
      throw new Error('Test!')
    },
    errorComponent: () => h('div', 'indexErrorComponent'),
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({
    routeTree,
    defaultErrorComponent: () => h('div', 'defaultErrorComponent'),
  })    

  render(() => h(RouterProvider, { router }))

  const errorElement = await screen.findByText('indexErrorComponent')
  expect(errorElement).toBeInTheDocument()
})

test('throw error from beforeLoad when navigating to route', async () => {
  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => h('div', [h('h1', 'Index page'), h(Link, { to: '/foo' }, () => 'link to foo')]),
    errorComponent: () => h('div', 'indexErrorComponent'),
  })

  const fooRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/foo',
    component: () => h('div', 'Foo page'),
    beforeLoad: () => {
      throw new Error('Test!')
    },
    errorComponent: () => h('div', 'fooErrorComponent'),
  })

  const routeTree = rootRoute.addChildren([indexRoute, fooRoute])
  const router = createRouter({
    routeTree,
    defaultErrorComponent: () => h('div', 'defaultErrorComponent'),
  })

  render(() => h(RouterProvider, { router }))

  const linkToFoo = await screen.findByRole('link', { name: 'link to foo' })

  expect(linkToFoo).toBeInTheDocument()

  fireEvent.click(linkToFoo)

  const indexElement = await screen.findByText('fooErrorComponent')
  expect(indexElement).toBeInTheDocument()
})

test('reproducer #4245', async () => {
  const LOADER_WAIT_TIME = 500
  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: async () => {
      await sleep(LOADER_WAIT_TIME)
      return 'index'
    },

    component: () => {
      const data = indexRoute.useLoaderData()
      return h('div', [h(Link, { to: '/foo', 'data-testid': 'link-to-foo' }, () => 'foo'), String(data.value)])
    },
  })

  const fooRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/foo',
    component: () => h(Link, { to: '/', 'data-testid': 'link-to-index' }, () => 'index'),
  })

  const routeTree = rootRoute.addChildren([indexRoute, fooRoute])
  const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))
  // We wait for the initial loader to complete
  await router.load()
  const fooLink = await screen.findByTestId('link-to-foo')

  expect(fooLink).toBeInTheDocument()

  // We navigate to the foo route
  fireEvent.click(fooLink)

  // We immediately see the content of the foo route
  const indexLink = await screen.findByTestId('link-to-index', undefined, {
    timeout: WAIT_TIME,
  })
  expect(indexLink).toBeInTheDocument()

  // We navigate to the index route
  fireEvent.click(indexLink)

  // We immediately see the content of the index route because the stale data is still available
  const fooLink2 = await screen.findByTestId('link-to-foo', undefined, {
    timeout: WAIT_TIME,
  })
  expect(fooLink2).toBeInTheDocument()

  // We navigate to the foo route again
  fireEvent.click(fooLink2)

  // We immediately see the content of the foo route
  const indexLink2 = await screen.findByTestId('link-to-index', undefined, {
    timeout: WAIT_TIME,
  })
  expect(indexLink2).toBeInTheDocument()

  // We navigate to the index route again
  fireEvent.click(indexLink2)

  // We now should see the content of the index route immediately because the stale data is still available
  const fooLink3 = await screen.findByTestId('link-to-foo', undefined, {
    timeout: WAIT_TIME,
  })
  expect(fooLink3).toBeInTheDocument()
})

test('reproducer #4546', async () => {
  const rootRoute = createRootRoute({
    component: () =>
      h('div', [
        h('div', { class: 'p-2 flex gap-2 text-lg' }, [
          h(
            Link,
            { 'data-testid': 'link-to-index', to: '/', activeProps: { class: 'font-bold' }, activeOptions: { exact: true } },
            () => 'Home',
          ),
          ' ',
          h(Link as any, { 'data-testid': 'link-to-id', to: '$id', params: { id: '1' }, activeProps: { class: 'font-bold' } }, () => '/1'),
        ]),
        h('hr'),
        h(Outlet),
      ]),
  })

  let counter = 0
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_app',
    beforeLoad: () => {
      counter += 1
      return {
        counter,
      }
    },
    component: () => h('div', [h(Header), h(Outlet)]),
  })

  function Header() {
    const router = useRouter()
    const ctx = appRoute.useRouteContext()

    return h('div', [
      'Header Counter: ',
      h('p', { 'data-testid': 'header-counter' }, String(ctx.value.counter)),
      h(
        'button',
        {
          onClick: () => {
            router.invalidate()
          },
          'data-testid': 'invalidate-router',
          style: {
            border: '1px solid blue',
          },
        },
        'Invalidate router',
      ),
    ])
  }

  const indexRoute = createRoute({
    getParentRoute: () => appRoute,
    path: '/',
    loader: ({ context }) => {
      return {
        counter: context.counter,
      }
    },

    component: () => {
      const data = indexRoute.useLoaderData()
      const ctx = indexRoute.useRouteContext()

      return h(
        'div',
        { style: { display: 'flex', 'flex-direction': 'column' } } as any,
        [
          h('div', 'Index route'),
          h('div', ['route context: ', h('p', { 'data-testid': 'index-route-context' }, String(ctx.value.counter))]),
          h('div', ['loader data: ', h('p', { 'data-testid': 'index-loader-data' }, String(data.value.counter))]),
        ],
      )
    },
  })

  const idRoute = createRoute({
    getParentRoute: () => appRoute,
    path: '$id',
    loader: ({ context }) => {
      return {
        counter: context.counter,
      }
    },

    component: () => {
      const data = idRoute.useLoaderData()
      const ctx = idRoute.useRouteContext()

      return h(
        'div',
        { style: { display: 'flex', 'flex-direction': 'column' } } as any,
        [
          h('div', '$id route'),
          h('div', ['route context: ', h('p', { 'data-testid': 'id-route-context' }, String(ctx.value.counter))]),
          h('div', ['loader data: ', h('p', { 'data-testid': 'id-loader-data' }, String(data.value.counter))]),
        ],
      )
    },
  })

  const routeTree = rootRoute.addChildren([appRoute.addChildren([indexRoute, idRoute])])
  const router = createRouter({ routeTree })

  render(() => h(RouterProvider, { router }))

  const indexLink = await screen.findByTestId('link-to-index')
  expect(indexLink).toBeInTheDocument()

  const idLink = await screen.findByTestId('link-to-id')
  expect(idLink).toBeInTheDocument()

  const invalidateRouterButton = await screen.findByTestId('invalidate-router')
  expect(invalidateRouterButton).toBeInTheDocument()

  {
    const headerCounter = await screen.findByTestId('header-counter')
    expect(headerCounter).toHaveTextContent('1')

    const routeContext = await screen.findByTestId('index-route-context')
    expect(routeContext).toHaveTextContent('1')

    const loaderData = await screen.findByTestId('index-loader-data')
    expect(loaderData).toHaveTextContent('1')
  }

  fireEvent.click(idLink)

  {
    // Wait for navigation to complete before checking values
    await screen.findByText('$id route')
    const headerCounter = await screen.findByTestId('header-counter')
    expect(headerCounter).toHaveTextContent('2')

    const routeContext = await screen.findByTestId('id-route-context')
    expect(routeContext).toHaveTextContent('2')

    const loaderData = await screen.findByTestId('id-loader-data')
    expect(loaderData).toHaveTextContent('2')
  }

  fireEvent.click(indexLink)

  {
    // Wait for navigation to complete before checking values
    await screen.findByText('Index route')
    const headerCounter = await screen.findByTestId('header-counter')
    expect(headerCounter).toHaveTextContent('3')

    const routeContext = await screen.findByTestId('index-route-context')
    expect(routeContext).toHaveTextContent('3')

    const loaderData = await screen.findByTestId('index-loader-data')
    expect(loaderData).toHaveTextContent('3')
  }

  fireEvent.click(invalidateRouterButton)

  {
    // Wait for router to invalidate and reload
    await new Promise((resolve) => setTimeout(resolve, 50))
    const headerCounter = await screen.findByTestId('header-counter')
    expect(headerCounter).toHaveTextContent('4')

    const routeContext = await screen.findByTestId('index-route-context')
    expect(routeContext).toHaveTextContent('4')

    const loaderData = await screen.findByTestId('index-loader-data')
    expect(loaderData).toHaveTextContent('4')
  }

  fireEvent.click(idLink)

  {
    // Wait for navigation to complete before checking values
    await screen.findByText('$id route')
    const headerCounter = await screen.findByTestId('header-counter')
    expect(headerCounter).toHaveTextContent('5')

    const routeContext = await screen.findByTestId('id-route-context')
    expect(routeContext).toHaveTextContent('5')

    const loaderData = await screen.findByTestId('id-loader-data')
    expect(loaderData).toHaveTextContent('5')
  }
})

test('clears pendingTimeout when match resolves', async () => {
  const defaultPendingComponentOnMountMock = vi.fn()
  const nestedPendingComponentOnMountMock = vi.fn()
  const fooPendingComponentOnMountMock = vi.fn()

  function getPendingComponent(onMount: () => void) {
    const PendingComponent = () => {
      onMount()
      return h('div', 'Pending...')
    }
    return PendingComponent
  }

  const history = createMemoryHistory({ initialEntries: ['/'] })

  const rootRoute = createRootRoute({})
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => h('div', [h('h1', 'Index page'), h(Link, { 'data-testid': 'link-to-foo', to: '/nested/foo' }, () => 'link to foo')]),
  })
  const nestedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/nested',
    // this route does not specify pendingMinMs, so it will use the defaultPendingMs from the router
    // which is set to WAIT_TIME * 2
    // since the loader immediately resolves, the pending component must NOT be shown
  pendingComponent: getPendingComponent(nestedPendingComponentOnMountMock),
    loader: () => {
      return 'nested'
    },
  })
  const fooRoute = createRoute({
    getParentRoute: () => nestedRoute,
    path: '/foo',
    // this route's loader takes WAIT_TIME * 5, so it will take longer than the defaultPendingMs
    // however, this route specifies pendingMs as WAIT_TIME * 10,
    // so this route's pending component must also NOT be shown
    pendingComponent: getPendingComponent(fooPendingComponentOnMountMock),
    pendingMs: WAIT_TIME * 10,
    loader: async () => {
      await sleep(WAIT_TIME * 5)
    },
  component: () => h('div', 'Nested Foo page'),
  })
  const routeTree = rootRoute.addChildren([
    nestedRoute.addChildren([fooRoute]),
    indexRoute,
  ])
  const router = createRouter({
    routeTree,
    history,
    defaultPendingMs: WAIT_TIME * 2,
    defaultPendingComponent: getPendingComponent(
      defaultPendingComponentOnMountMock,
    ),
  })

  render(() => h(RouterProvider, { router }))
  await router.latestLoadPromise
  const linkToFoo = await screen.findByTestId('link-to-foo')
  fireEvent.click(linkToFoo)
  const fooElement = await screen.findByText('Nested Foo page')
  expect(fooElement).toBeInTheDocument()

  expect(router.state.location.href).toBe('/nested/foo')

  // none of the pending components should have been called
  expect(defaultPendingComponentOnMountMock).not.toHaveBeenCalled()
  expect(nestedPendingComponentOnMountMock).not.toHaveBeenCalled()
  expect(fooPendingComponentOnMountMock).not.toHaveBeenCalled()
})
