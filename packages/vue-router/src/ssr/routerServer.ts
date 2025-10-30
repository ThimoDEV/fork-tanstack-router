// RouterServer.vue-lib.ts
import { defineComponent, h, Teleport, type PropType } from 'vue'
import type { AnyRouter } from '@tanstack/router-core'
import { Asset } from '../asset'
import { useTags } from '../headContent'
import { RouterProvider } from '../routerProvider'
import { Scripts } from '../scripts'

// Vue version of ServerHeadContent:
// - Renders collected tags into <head> using Teleport.
// - Solid's useAssets/MetaProvider/Hydration* are not needed in Vue.
export const ServerHeadContent = defineComponent({
  name: 'ServerHeadContent',
  setup() {
    const tags = useTags()
    return () =>
      h(
        Teleport,
        { to: 'head' },
        tags().map((tag: Record<string, any>, i: number) =>
          h(Asset as any, { key: i, ...tag }),
        ),
      )
  },
})

// Vue version of RouterServer:
// - The <!DOCTYPE html> should be injected by your stream/string renderer (as in your renderRouterToString/Stream functions).
// - We return an <html> tree; Vue SSR will serialize it correctly.
// - HydrationScript/Hydration/NoHydration/MetaProvider are Solid-specific and omitted.
export const RouterServer = defineComponent({
  name: 'RouterServer',
  props: {
    router: {
      type: Object as PropType<AnyRouter>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('html', null, [
        h('head'), // <ServerHeadContent> teleports into here
        h('body', null, [
          h(RouterProvider as any, {
            router: props.router,
            InnerWrap: (p: { children?: any }) =>
              // Keep structure similar to Solid version: head content + children + scripts
              h('div', null, [
                h(ServerHeadContent),
                p.children,
                h(Scripts as any),
              ]),
          }),
        ]),
      ])
  },
})
