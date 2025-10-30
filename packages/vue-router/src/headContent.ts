import * as Vue from 'vue'
import { Asset } from './asset'
import { useRouter } from './useRouter'
import { useRouterState } from './useRouterState'
import type { RouterManagedTag } from '@tanstack/router-core'

export const useTags = () => {
  const router = useRouter()
  const nonce = router.options.ssr?.nonce

  const routeMeta = useRouterState({
    select: (state) => state.matches.map((m) => m.meta!).filter((x) => Array.isArray(x)).filter(Boolean),
  })

  const meta = Vue.computed<Array<RouterManagedTag>>(() => {
    const resultMeta: Array<RouterManagedTag> = []
    const metaByAttribute: Record<string, true> = {}
    let title: RouterManagedTag | undefined

    const routeMetasArray = routeMeta.value
    for (let i = routeMetasArray.length - 1; i >= 0; i--) {
      const metas = routeMetasArray[i]!
      for (let j = metas.length - 1; j >= 0; j--) {
        const m = metas[j]
        if (!m) continue

        if (m.title) {
          if (!title) {
            title = {
              tag: 'title',
              children: m.title,
            }
          }
        } else {
          const attribute = m.name ?? m.property
          if (attribute) {
            if (metaByAttribute[attribute]) {
              continue
            } else {
              metaByAttribute[attribute] = true
            }
          }

          resultMeta.push({
            tag: 'meta',
            attrs: {
              ...m,
              nonce,
            },
          })
        }
      }
    }

    if (title) resultMeta.push(title)

    if (router.options.ssr?.nonce) {
      resultMeta.push({
        tag: 'meta',
        attrs: {
          property: 'csp-nonce',
          content: router.options.ssr.nonce,
        },
      })
    }

    resultMeta.reverse()

    return resultMeta
  })

  const links = useRouterState({
    select: (state) => {
      const constructed =
        state.matches
          .map((match) => match.links!)
          .filter(Boolean)
          .flat(1)
          .map(
            (link) =>
              ({
                tag: 'link',
                attrs: { ...link, nonce },
              }),
          ) satisfies Array<RouterManagedTag>

      const manifest = router.ssr?.manifest

      const assets =
        state.matches
          .map((match) => manifest?.routes[match.routeId]?.assets ?? [])
          .filter(Boolean)
          .flat(1)
          .filter((asset) => asset.tag === 'link')
          .map(
            (asset) =>
              ({
                tag: 'link',
                attrs: { ...asset.attrs, nonce },
              }) satisfies RouterManagedTag,
          )

      return [...constructed, ...assets]
    },
  })

  const preloadMeta = useRouterState({
    select: (state) => {
      const preloadMeta: Array<RouterManagedTag> = []

      state.matches
        .map((match) => router.looseRoutesById[match.routeId]!)
        .forEach((route) =>
          router.ssr?.manifest?.routes[route.id]?.preloads
            ?.filter(Boolean)
            .forEach((preload) => {
              preloadMeta.push({
                tag: 'link',
                attrs: {
                  rel: 'modulepreload',
                  href: preload,
                  nonce,
                },
              })
            }),
        )

      return preloadMeta
    },
  })

  const styles = useRouterState({
    select: (state) =>
      (
        state.matches
          .map((match) => match.styles!)
          .flat(1)
          .filter(Boolean) as Array<RouterManagedTag>
      ).map(({ children, ...style }) => ({
        tag: 'style',
        attrs: { ...style, nonce },
        children,
      })),
  })

  const headScripts = useRouterState({
    select: (state) =>
      (
        state.matches
          .map((match) => match.headScripts!)
          .flat(1)
          .filter(Boolean) as Array<RouterManagedTag>
      ).map(({ children, ...script }) => ({
        tag: 'script',
        attrs: { ...script, nonce },
        children,
      })),
  })

  return () =>
    uniqBy(
      [
        ...meta.value,
        ...preloadMeta.value,
        ...links.value,
        ...styles.value,
        ...headScripts.value,
      ] as Array<RouterManagedTag>,
      (d) => JSON.stringify(d),
    )
}


export const HeadContent = Vue.defineComponent({
  name: 'HeadContent',
  setup() {
    const tags = useTags()
    return () =>
      Vue.h(
        Vue.Fragment,
        {},
        tags().map((tag) => Vue.h(Asset as any, { ...tag })),
      )
  },
})

function uniqBy<T>(arr: Array<T>, fn: (item: T) => string) {
  const seen = new Set<string>()
  return arr.filter((item) => {
    const key = fn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
