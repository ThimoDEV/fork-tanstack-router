import { h } from 'vue'
import { createLazyFileRoute, createLazyRoute } from '../../src'

export function Route(id: string) {
  return createLazyRoute(id)({
    component: () => h('h1', "I'm a normal route"),
  })
}

export function FileRoute(id: string) {
  return createLazyFileRoute(id as never)({
    component: () => h('h1', "I'm a normal file route"),
  })
}
