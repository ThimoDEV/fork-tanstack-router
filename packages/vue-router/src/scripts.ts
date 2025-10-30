import { defineComponent, h } from 'vue'
import { Asset } from './asset'
import { useRouterState } from './useRouterState'
import { useRouter } from './useRouter'
import type { RouterManagedTag } from '@tanstack/router-core'

export const Scripts = defineComponent({
  name: 'Scripts',
  setup() {
    const router = useRouter()
    const nonce = router.options.ssr?.nonce

    const assetScripts = useRouterState({
      select: (state) => {
        const assetScripts: Array<RouterManagedTag> = []
        const manifest = router.ssr?.manifest

        if (!manifest) return []

        state.matches
          .map((m) => router.looseRoutesById[m.routeId]!)
          .forEach((route) => {
            manifest.routes[route.id]?.assets
              ?.filter((a) => a.tag === 'script')
              .forEach((asset) => {
                assetScripts.push({
                  tag: 'script',
                  attrs: { ...asset.attrs, nonce },
                  children: asset.children,
                } as any)
              })
          })

        return assetScripts
      },
    })

    const scripts = useRouterState({
      select: (state) => {
        const list = (state.matches
          .map((m) => m.scripts!)
          .flat()
          .filter(Boolean) as RouterManagedTag[]).map(({ children, ...script }) => ({
          tag: 'script',
          attrs: { ...(script as any), nonce },
          children,
        }))
        return { scripts: list }
      },
    })

    return () => {
      const allScripts = [
        ...scripts.value.scripts,
        ...assetScripts.value,
      ] as Array<RouterManagedTag>

      return allScripts.map((asset, i) => h(Asset, { ...asset, key: i }))
    }
  },
})
