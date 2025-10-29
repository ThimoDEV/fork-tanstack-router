import * as Vue from 'vue'
import type { AnyRouter } from '@tanstack/router-core'

declare global {
  interface Window {
    __TSR_ROUTER_CONTEXT__?: Vue.InjectionKey<AnyRouter>
  }
}

const routerContext = Symbol('TSR_ROUTER_CONTEXT') as Vue.InjectionKey<AnyRouter>

export function getRouterContext() {
  if (typeof document === 'undefined') {
    return routerContext
  }

  if (window.__TSR_ROUTER_CONTEXT__) {
    return window.__TSR_ROUTER_CONTEXT__
  }

  window.__TSR_ROUTER_CONTEXT__ = routerContext as any

  return routerContext
}
