import { defineComponent, h } from 'vue'
import { useRouter } from './useRouter'

export const ScriptOnce = defineComponent({
  name: 'ScriptOnce',
  props: {
    children: { type: String, required: true },
    // kept for API parity with your Solid version (not used here)
    log: { type: Boolean, default: false },
    sync: { type: Boolean, default: false },
  },
  setup(props) {
    const router = useRouter()

    return () => {
      // Only render on the server
      if (router && !router.isServer) return null

      return h('script', {
        nonce: router.options.ssr?.nonce,
        class: '$tsr',
        innerHTML: [props.children].filter(Boolean).join('\n') + ';$_TSR.c()',
      })
    }
  },
})