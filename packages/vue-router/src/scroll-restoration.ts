import { defineComponent, h } from 'vue'
import {
  defaultGetScrollRestorationKey,
  restoreScroll,
  storageKey,
} from '@tanstack/router-core'
import { useRouter } from './useRouter'
import { ScriptOnce } from './scriptOnce'

export const ScrollRestoration = defineComponent({
  name: 'ScrollRestoration',
  setup() {
    const router = useRouter()

    return () => {
      // Only render on server during scroll-restoration phase
      if (!router.isScrollRestoring || !router.isServer) return null

      // Optional user-defined guard
      if (typeof router.options.scrollRestoration === 'function') {
        const shouldRestore = router.options.scrollRestoration({
          location: router.latestLocation,
        })
        if (!shouldRestore) return null
      }

      const getKey =
        router.options.getScrollRestorationKey ?? defaultGetScrollRestorationKey
      const userKey = getKey(router.latestLocation)
      const resolvedKey =
        userKey !== defaultGetScrollRestorationKey(router.latestLocation)
          ? userKey
          : undefined

      const restoreScrollOptions: Parameters<typeof restoreScroll>[0] = {
        storageKey,
        shouldScrollRestoration: true,
      }
      if (resolvedKey) {
        restoreScrollOptions.key = resolvedKey
      }

      // Inline-call restoreScroll on the client via a one-time SSR <script>
      const payload = `(${restoreScroll.toString()})(${JSON.stringify(restoreScrollOptions)})`

      return h(ScriptOnce, { children: payload })
    }
  },
})