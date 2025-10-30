import { h, type VNode } from 'vue'
import warning from 'tiny-warning'
import { DefaultGlobalNotFound } from './not-found'
import type { AnyRoute, AnyRouter } from '@tanstack/router-core'

export function renderRouteNotFound(
  router: AnyRouter,
  route: AnyRoute,
  data: any,
): VNode {
  const routeNotFoundComp = route.options.notFoundComponent as any
  const defaultNotFoundComp = (router.options as any).defaultNotFoundComponent as any

  if (!routeNotFoundComp) {
    if (defaultNotFoundComp) {
      // Render router-level default not-found component
      return h(defaultNotFoundComp, { data })
    }

    if (process.env.NODE_ENV === 'development') {
      warning(
        routeNotFoundComp,
        `A notFoundError was encountered on the route with ID "${route.id}", but a notFoundComponent option was not configured, nor was a router level defaultNotFoundComponent configured. Consider configuring at least one of these to avoid TanStack Router's overly generic defaultNotFoundComponent (<div>Not Found<div>)`,
      )
    }

    // Fallback to our library default
    return h(DefaultGlobalNotFound)
  }

  // Route-level not-found component
  return h(routeNotFoundComp, { data })
}