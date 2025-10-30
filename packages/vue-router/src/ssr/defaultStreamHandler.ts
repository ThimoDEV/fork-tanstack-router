import { defineHandlerCallback } from '@tanstack/router-core/ssr/server'
import { h } from 'vue'
import { RouterServer } from './routerServer'
import { renderRouterToStream } from './renderRouterToStream'

export const defaultStreamHandler = defineHandlerCallback(
  ({ request, router, responseHeaders }) =>
    renderRouterToStream({
      request,
      router,
      responseHeaders,
      children: () => h(RouterServer, { router }),
    }),
)
