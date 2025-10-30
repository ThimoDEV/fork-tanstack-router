// RouterClient.vue-lib.ts
import { hydrate } from '@tanstack/router-core/ssr/client'
import { Await } from '../awaited'
import { HeadContent } from '../headContent'
import { RouterProvider } from '../routerProvider'
import type { AnyRouter } from '@tanstack/router-core'
import { defineComponent, h, type PropType } from 'vue'

let hydrationPromise: Promise<void | Array<Array<void>>> | undefined

const Dummy = defineComponent({
  name: 'Dummy',
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})

export const RouterClient = defineComponent({
  name: 'RouterClient',
  props: {
    router: {
      type: Object as PropType<AnyRouter>,
      required: true,
    },
  },
  setup(props) {
    if (!hydrationPromise) {
      if (!props.router.state.matches.length) {
        hydrationPromise = hydrate(props.router)
      } else {
        hydrationPromise = Promise.resolve()
      }
    }

    return () =>
      h(
        Await as any,
        { promise: hydrationPromise },
        {
          default: () =>
            h(
              Dummy,
              {},
              {
                default: () =>
                  h(
                    Dummy,
                    {},
                    {
                      default: () =>
                        h(RouterProvider as any, {
                          router: props.router,
                          InnerWrap: (p: { children?: any }) =>
                            h(
                              Dummy,
                              {},
                              {
                                default: () => [
                                  h(
                                    Dummy,
                                    {},
                                    {
                                      default: () => [h(HeadContent as any), p.children],
                                    },
                                  ),
                                  h(Dummy),
                                ],
                              },
                            ),
                        }),
                    },
                  ),
              },
            ),
        },
      )
  },
})
