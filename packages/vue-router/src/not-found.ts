import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import { isNotFound, type NotFoundError, type ErrorComponentProps } from '@tanstack/router-core'
import { CatchBoundary } from './catchBoundary'
import { useRouterState } from './useRouterState'
import type { ErrorRouteComponent } from './route'

export const CatchNotFound = defineComponent({
  name: 'CatchNotFound',
  props: {
    fallback: {
      // Renders when the error is a NotFoundError
      type: Function as PropType<(error: NotFoundError) => VNodeChild>,
      required: false,
    },
    onCatch: {
      type: Function as PropType<(error: Error) => void>,
      required: false,
    },
  },
  setup(props, { slots }) {
    // Same reset key logic as the Solid version
    const resetKey = useRouterState({
      select: (s: any) => `not-found-${s.location.pathname}-${s.status}`,
    })

    // Inline error component that only renders for NotFound,
    // otherwise re-throws to bubble to another boundary
    const NotFoundErrorComponent: ErrorRouteComponent = (ecProps: ErrorComponentProps) => {
      const err = ecProps.error
      if (isNotFound(err)) {
        return props.fallback ? props.fallback(err as NotFoundError) : null
      }
      throw err
    }

    return () =>
      h(
        CatchBoundary,
        {
          getResetKey: () => resetKey.value,
          onCatch: (error: Error) => {
            if (isNotFound(error)) {
              props.onCatch?.(error)
            } else {
              throw error
            }
          },
          errorComponent: NotFoundErrorComponent,
        },
        slots.default ? { default: () => slots.default!() } : undefined,
      )
  },
})

export const DefaultGlobalNotFound = defineComponent({
  name: 'DefaultGlobalNotFound',
  setup() {
    return () => h('p', 'Not Found')
  },
})