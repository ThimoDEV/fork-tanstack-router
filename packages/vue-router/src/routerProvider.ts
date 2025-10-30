import * as Vue from 'vue'
import { getRouterContext } from './routerContext'
import { SafeFragment } from './safeFragment'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterOptions,
} from '@tanstack/router-core'
import type { PropType } from 'vue'
import { Matches } from './matches'

export type RouterProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
> = Omit<
  RouterOptions<
    TRouter['routeTree'],
    NonNullable<TRouter['options']['trailingSlash']>,
    false,
    TRouter['history'],
    TDehydrated
  >,
  'context'
> & {
  router: TRouter
  context?: Partial<
    RouterOptions<
      TRouter['routeTree'],
      NonNullable<TRouter['options']['trailingSlash']>,
      false,
      TRouter['history'],
      TDehydrated
    >['context']
  >
}

export const RouterContextProvider = Vue.defineComponent({
  name: 'RouterContextProvider',
  props: {
    router: {
      type: Object as PropType<AnyRouter>,
      required: true,
    },
    context: {
      type: Object as PropType<Record<string, any> | undefined>,
      required: false,
    },
  },
  setup(props, { slots, attrs }) {
    const router = props.router as AnyRouter

    router.update({
      ...router.options,
      ...(attrs as any),
      context: {
        ...router.options.context,
        ...(props.context ?? {}),
      },
    } as any)

    const routerContext = getRouterContext()
    Vue.provide(routerContext as any, router as AnyRouter)

    const OptionalWrapper = router.options.Wrap || SafeFragment

    return () =>
      Vue.h(
        OptionalWrapper as any,
        {},
        slots.default ? slots.default() : [],
      )
  },
})

export const RouterProvider = Vue.defineComponent({
  name: 'RouterProvider',
  props: {
    router: {
      type: Object as PropType<AnyRouter>,
      required: true,
    },
    context: {
      type: Object as PropType<Record<string, any> | undefined>,
      required: false,
    },
  },
  setup(props, { attrs }) {
    return () =>
      Vue.h(
        RouterContextProvider,
        {
          router: props.router,
          context: props.context,
          ...(attrs as any), 
        },
        {
          default: () => [Vue.h(Matches)],
        },
      )
  },
})
