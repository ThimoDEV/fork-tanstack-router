import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/vue'
import { h, defineComponent, ref, onErrorCaptured } from 'vue'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'

// A function-style Vue component (functional component) that throws during render
const ThrowingComponent = (_props: any) => {
  throw new Error('Test error')
}

// Custom error boundary to catch errors that bubble up
const TestErrorBoundary = defineComponent({
  setup(_, { slots }) {
    const error = ref<any>(null)

    onErrorCaptured((err) => {
      error.value = err
      // return false so the error does not propagate further
      return false
    })

    return () => {
      if (error.value) {
        return h('div', `External Error Boundary Caught: ${error.value.message}`)
      }

      return slots.default ? slots.default() : null
    }
  },
})

function createTestRouter(disableGlobalCatchBoundary: boolean) {
  const rootRoute = createRootRoute({})
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: ThrowingComponent,
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  return createRouter({
    routeTree,
    disableGlobalCatchBoundary,
  })
}

afterEach(() => {
  vi.resetAllMocks()
  // reset history to root
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

describe('disableGlobalCatchBoundary option', () => {
  test('catches errors in global boundary when disableGlobalCatchBoundary is false', async () => {
    const router = createTestRouter(false)

    render(() => h(RouterProvider, { router }))

    // The global CatchBoundary shows "Something went wrong!" by default
    const errorElement = await screen.findByText('Something went wrong!')
    expect(errorElement).toBeInTheDocument()
  })

  test('errors bubble up to external error boundary when disableGlobalCatchBoundary is true', async () => {
    const router = createTestRouter(true)

    // Wrap RouterProvider in an external error boundary
    render(() =>
      h(TestErrorBoundary, null, {
        default: () => h(RouterProvider, { router }),
      }),
    )

    // Error should bubble up and be caught by the external error boundary
    const externalErrorElement = await screen.findByText(
      'External Error Boundary Caught: Test error',
    )
    expect(externalErrorElement).toBeInTheDocument()
  })
})
