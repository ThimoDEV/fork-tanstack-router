import { defineComponent, h, onMounted, onBeforeUnmount, PropType, onUnmounted } from 'vue'
import { useRouter } from './useRouter'
import type { RouterManagedTag } from '@tanstack/router-core'

export const Asset = defineComponent({
    name: 'Asset',
    props: {
         tag: { type: String as PropType<RouterManagedTag['tag']>, required: true },
        attrs: { type: Object as PropType<Record<string, any>>, required: false },
        children: { type: String as PropType<string>, required: false },
    },
    setup(props) {
    switch (props.tag) {
      case 'title':
        return () => h('title', props.attrs ?? {}, props.children)
      case 'meta':
        return () => h('meta', props.attrs ?? {})
      case 'link':
        return () => h('link', props.attrs ?? {})
      case 'style':
        return () => h('style', props.attrs ?? {}, props.children)
      case 'script':
        return () =>
          h(Script, {
            attrs: props.attrs as ScriptAttrs | undefined,
            children: props.children,
          })
      default:
        return () => null
    }
  },
})

interface ScriptAttrs {
  [key: string]: string | boolean | undefined
  src?: string
}

const Script = defineComponent({
    name: 'Script',
     props: {
        attrs: { type: Object as PropType<ScriptAttrs>, required: false },
        children: { type: String as PropType<string>, required: false },
  },
  setup(props) {
    const router = useRouter()

    let createdScriptEl: HTMLScriptElement | null = null

    onMounted(() => {
        if (props.attrs?.src) {
            const normSrc = (() => {
                try {
                    const base = document.baseURI || window.location.href
                    return new URL(props.attrs!.src!, base).href
                } catch {
                    return props.attrs!.src!
                }
            })()

        const existingScript = Array.from(
          document.querySelectorAll('script[src]'),
        ).find((el) => (el as HTMLScriptElement).src === normSrc)

        if (existingScript) {
            return
        }

        const script = document.createElement('script')

        for (const [key, value] of Object.entries(props.attrs)) {
            if (value !== undefined && value !== false) {
              script.setAttribute(key, typeof value === 'boolean' ? '' : String(value))
            }
          }

          document.head.appendChild(script)
          createdScriptEl = script
        }

        if (typeof props.children === 'string') {
        const typeAttr =
          typeof props.attrs?.type === 'string' ? (props.attrs!.type as string) : 'text/javascript'
        const nonceAttr =
          typeof props.attrs?.nonce === 'string' ? (props.attrs!.nonce as string) : undefined

        const existingInline = Array.from(
          document.querySelectorAll('script:not([src])'),
        ).find((el) => {
          if (!(el instanceof HTMLScriptElement)) return false
          const sType = el.getAttribute('type') ?? 'text/javascript'
          const sNonce = el.getAttribute('nonce') ?? undefined
          return el.textContent === props.children && sType === typeAttr && sNonce === nonceAttr
        })

        if (!existingInline) {
          const s = document.createElement('script')
          s.textContent = props.children

          if (props.attrs) {
            for (const [key, value] of Object.entries(props.attrs)) {
              if (value !== undefined && value !== false) {
                s.setAttribute(key, typeof value === 'boolean' ? '' : String(value))
              }
            }
          }

          document.head.appendChild(s)
          createdScriptEl = s
        }
      }
    })

    onBeforeUnmount(() => {
        if (createdScriptEl && createdScriptEl.parentNode) {
            createdScriptEl.parentNode.removeChild(createdScriptEl)
        }
        createdScriptEl = null
    })

    return () => {
      if (router && !router.isServer) return null

      const attrs = props.attrs ?? {}

      if (attrs.src && typeof attrs.src === 'string') {
        return h('script', attrs)
      }

      if (typeof props.children === 'string') {
        return h('script', attrs, props.children)
      }

      return null
    }
  }
})