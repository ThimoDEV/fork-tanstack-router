import { defineComponent, h, onServerPrefetch, shallowRef } from 'vue'
import { isModuleNotFoundError } from '@tanstack/router-core'
import type { AsyncRouteComponent } from './route'

export function lazyRouteComponent<
  T extends Record<string, any>,
  TKey extends keyof T = 'default',
>(
  importer: () => Promise<T>,
  exportName?: TKey,
): T[TKey] extends (props: infer TProps) => any
  ? AsyncRouteComponent<TProps>
  : never {
  let loadPromise: Promise<any> | undefined
  const compRef = shallowRef<T[TKey] | T['default'] | null>(null)
  const errorRef = shallowRef<any>(null)

  const load = () => {
    if (!loadPromise) {
      loadPromise = importer()
        .then((res) => {
          loadPromise = undefined
          const picked = (res as any)[(exportName as string) ?? 'default']
          compRef.value = picked
          return picked
        })
        .catch((err) => {
          errorRef.value = err
          // rethrow so awaiters can catch if they want
          throw err
        })
    }
    return loadPromise
  }

  const lazyComp = defineComponent({
    name: 'LazyRouteComponent',
    async setup(_props, { attrs, slots }) {
      // SSR: preload the component so it's ready on first render
      if (typeof window === 'undefined') {
        try {
          await load()
        } catch {
          // ignore here; we handle the error in render path to keep parity
        }
      } else {
        // Client: kick off the load if not already started
        if (!compRef.value && !errorRef.value) {
          void load()
        }
      }

      return () => {
        const error = errorRef.value
        if (error) {
          // Handle module-not-found once by triggering a reload
          if (
            isModuleNotFoundError(error) &&
            error instanceof Error &&
            typeof window !== 'undefined' &&
            typeof sessionStorage !== 'undefined'
          ) {
            const storageKey = `tanstack_router_reload:${error.message}`
            if (!sessionStorage.getItem(storageKey)) {
              sessionStorage.setItem(storageKey, '1')
              window.location.reload()
              // Return nothing while the page reloads
              return null
            }
          }
          // Otherwise, surface the error
          throw error
        }

        const Comp = compRef.value as any
        if (!Comp) {
          // Still loading: render nothing (or swap with a placeholder if desired)
          return null
        }

        // Render the resolved async component with current attrs/slots
        return h(Comp, attrs as any, slots)
      }
    },
  }) as unknown as AsyncRouteComponent<
    T[TKey] extends (props: infer TProps) => any ? TProps : never
  >

  ;(lazyComp as any).preload = () => load().then(() => void 0)

  return lazyComp as any
}