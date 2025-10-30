import { render } from '@testing-library/vue'
import { bench, describe } from 'vitest'
import { h } from 'vue'
import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  interpolatePath,
  useRouter,
} from '../src'
import type { LinkProps } from '../src'
import type * as Vue from 'vue'

const createRouterRenderer =
  (routesCount: number) => (children: Vue.VNode | Vue.VNode[] | string) => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => children,
    })
    const paramRoutes = Array.from({ length: routesCount }).map((_, i) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path: `/params/$param${i}`,
      }),
    )
    const routeTree = rootRoute.addChildren([indexRoute, ...paramRoutes])
    return createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
  }

const InterpolatePathLink = (props: LinkProps, { slots }: any) => {
  const href = interpolatePath({ path: props.to as string, params: props.params }).interpolatedPath
  return h('a', { href }, slots?.default ? slots.default() : null)
}

const BuildLocationLink = (props: LinkProps, { slots }: any) => {
  const router = useRouter()
  const { href } = router.buildLocation(props)
  return h('a', { href }, slots?.default ? slots.default() : null)
}

describe.each([
  {
    name: 'small router',
    numberOfRoutes: 1,
    matchedParamId: 0, // range from 0 to numberOfRoutes-1
    numberOfLinks: 5000,
  },
  {
    name: 'medium router',
    numberOfRoutes: 1000,
    matchedParamId: 500, // range from 0 to numberOfRoutes-1
    numberOfLinks: 5000,
  },
])('$name', ({ numberOfRoutes, numberOfLinks, matchedParamId }) => {
  const renderRouter = createRouterRenderer(numberOfRoutes)

  bench(
    'hardcoded href',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) => h('a', { href: `/params/${i}` }, String(i))),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'interpolate path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) =>
              h(
                InterpolatePathLink as any,
                {
                  to: `/params/$param${Math.min(i, matchedParamId)}`,
                  params: { [`param${Math.min(i, matchedParamId)}`]: i },
                },
                { default: () => String(i) },
              ),
        ),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'build location',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) =>
              h(
                BuildLocationLink as any,
                {
                  to: `/params/$param${Math.min(i, matchedParamId)}`,
                  params: { [`param${Math.min(i, matchedParamId)}`]: i },
                },
                { default: () => String(i) },
              ),
        ),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to absolute path',
    () => {
      const router = renderRouter(
        Array.from({ length: numberOfLinks }).map((_, i) =>
              h(
                Link as any,
                {
                  to: `/params/$param${Math.min(i, matchedParamId)}`,
                  params: { [`param${Math.min(i, matchedParamId)}`]: i },
                },
                { default: () => String(i) },
              ),
        ),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to relative path',
    () => {
      const router = renderRouter(
          Array.from({ length: numberOfLinks }).map((_, i) => {
          const to = `./params/$param${Math.min(i, matchedParamId)}`

          return h(
            Link as any,
            {
              from: '/',
              to,
              params: { [`param${Math.min(i, matchedParamId)}`]: i },
            },
            { default: () => String(i) },
          )
        }),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )

  bench(
    'link to current path',
    () => {
      const router = renderRouter(
    Array.from({ length: numberOfLinks }).map((_, i) =>
      h(Link as any, { from: '/', search: { param: i } }, { default: () => String(i) }),
    ),
      )
      render(h(RouterProvider, { router }))
    },
    { warmupIterations: 1 },
  )
})
