// defaultRenderHandler.vue-lib.ts
import { defineHandlerCallback } from '@tanstack/router-core/ssr/server'
import { h } from 'vue'
import { RouterServer } from './routerServer'
import { renderRouterToString } from './renderRouterToString'

export const defaultRenderHandler = defineHandlerCallback(
  ({ router, responseHeaders }) =>
    renderRouterToString({
      router,
      responseHeaders,
      children: () => h(RouterServer, { router }),
    }),
)
