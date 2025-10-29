
import { TSR_DEFERRED_PROMISE, defer } from '@tanstack/router-core'
import type { DeferredPromise } from '@tanstack/router-core'
import type { FallbackType, VueNode } from './route'
import { defineComponent, h, PropType, Suspense } from 'vue'

export type AwaitOptions<T> = {
  promise: Promise<T>
}

export function useAwaited<T>({
  promise: _promise,
}: AwaitOptions<T>): [T, DeferredPromise<T>] {
  const promise = defer(_promise)

  if (promise[TSR_DEFERRED_PROMISE].status === 'pending') {
    // Parity with Solid: throw to "suspend".
    // In Vue this won't trigger Suspense by itself if thrown in setup(), but we keep parity.
    throw promise
  }

  if (promise[TSR_DEFERRED_PROMISE].status === 'error') {
    throw promise[TSR_DEFERRED_PROMISE].error
  }

  return [promise[TSR_DEFERRED_PROMISE].data as T, promise]
}

export const Await = defineComponent({
  name: 'Await',
  props: {
    promise: {
      type: Object as PropType<Promise<unknown>>,
      required: true,
    },
     fallback: {
      type: [String, Object, Array, Function] as PropType<FallbackType>,
      required: false,
    },
    // keep the Solid-style render-prop signature for consumers
    children: {
      type: Function as PropType<(result: unknown) => VueNode>,
      required: true,
    },
  },
  setup(props) {
    // Inner async component that actually awaits the promise
    const AwaitInner = defineComponent({
      name: 'AwaitInner',
      props: {
        promise: {
          type: Object as PropType<Promise<unknown>>,
          required: true,
        },
        children: {
          type: Function as PropType<(result: unknown) => VueNode>,
          required: true,
        },
      },
      // async setup is what Suspense waits for in Vue
      async setup(iprops) {
        // Keep the same defer semantics you have in Solid
        const deferred = defer(iprops.promise)
        // Await the deferred (resolves to the data or throws)
        const data = await deferred

        // Once resolved, render the children(result)
        return () => {
          return iprops.children(data)
        }
      },
    })

    // Render a Suspense around the inner async component.
    // `fallback` matches the Solid API.
    return () =>
      h(
        Suspense,
        {},
        {
          default: () =>
            h(AwaitInner, {
              promise: props.promise,
              children: props.children,
            }),
          fallback: () => (typeof props.fallback === 'function' ? props.fallback() : props.fallback ?? null),
        },
      )
  },
})
