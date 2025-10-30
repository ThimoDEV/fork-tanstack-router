import {
  defineComponent,
  h,
  onMounted,
  PropType,
  ref,
  type readonly,
  type Ref,
  type VNodeChild,
} from 'vue'

export interface ClientOnlyProps {
  /**
   * The fallback component to render if the JS is not yet loaded.
   */
  fallback?: VNodeChild | (() => VNodeChild)
}

export const ClientOnly = defineComponent<ClientOnlyProps>({
  name: 'ClientOnly',
  props: {
    fallback: {
      type: [String, Object, Array, Function] as PropType<
        VNodeChild | (() => VNodeChild)
      >,
      required: false,
    },
  },
  setup(props, { slots }) {
    const hydrated = useHydrated()

    return () => {
      if (hydrated.value) {
        // Render children (default slot) once hydrated
        return slots.default ? slots.default() : undefined
      }

      // Until hydrated, render the fallback if provided
      const fb = props.fallback
      return typeof fb === 'function' ? (fb as () => VNodeChild)() : fb ?? undefined
    }
  },
})

export function useHydrated(): Readonly<Ref<boolean>> {
  const hydrated = ref(false)
  onMounted(() => {
    hydrated.value = true
  })
  return hydrated
}

