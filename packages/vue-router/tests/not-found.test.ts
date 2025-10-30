import { afterEach, beforeEach, expect, test } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/vue'
import { h } from 'vue'

import {
  Link,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import type { RouterHistory } from '../src'

let history: RouterHistory

beforeEach(() => {
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

test.each([
  {
    notFoundMode: 'fuzzy' as const,
    expectedNotFoundComponent: 'settings-not-found',
  },
  {
    notFoundMode: 'root' as const,
    expectedNotFoundComponent: 'root-not-found',
  },
])(
  'correct notFoundComponent is rendered for mode=%s',
  async ({ notFoundMode, expectedNotFoundComponent }) => {
    const rootRoute = createRootRoute({
      component: () =>
        h('div', { 'data-testid': 'root-component' }, [
          h('h1', 'Root Component'),
          h('div', [
            h(Link as any, { 'data-testid': 'settings-link', to: '/settings/' }, 'link to settings'),
            ' ',
            h(Link as any, { 'data-testid': 'non-existing-link', to: '/settings/does-not-exist' }, 'link to non-existing route'),
          ]),
          h(Outlet),
        ]),
      notFoundComponent: () => h('span', { 'data-testid': 'root-not-found' }, 'Root Not Found Component'),
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => h('div', { 'data-testid': 'index-component' }, [h('h2', 'Index Page')]),
    })

    const settingsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/settings',
      notFoundComponent: () => h('span', { 'data-testid': 'settings-not-found' }, 'Settings Not Found Component'),
      component: () => h('div', [h('p', 'Settings Page Layout'), h(Outlet)]),
    })

    const settingsIndexRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: '/',
      component: () => h('div', { 'data-testid': 'settings-index-component' }, 'Settings Page'),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        settingsRoute.addChildren([settingsIndexRoute]),
      ]),
      history,
      notFoundMode,
    })

    render(() => h(RouterProvider, { router }))
    await router.load()
    await screen.findByTestId('root-component')

    const settingsLink = screen.getByTestId('settings-link')
    await fireEvent.click(settingsLink)

    const settingsIndexComponent = await screen.findByTestId('settings-index-component')
    expect(settingsIndexComponent).toBeInTheDocument()

    const nonExistingLink = screen.getByTestId('non-existing-link')
    await fireEvent.click(nonExistingLink)

    const notFoundComponent = await screen.findByTestId(expectedNotFoundComponent, {}, { timeout: 1000 })
    expect(notFoundComponent).toBeInTheDocument()
  },
)
