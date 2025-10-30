import { defineComponent } from 'vue'

// Kept here for backwards compatibility, Vue doesn't need a special fragment component anymore

export const SafeFragment = defineComponent({
  name: 'SafeFragment',
  props: {} as any,
  setup(_props, { slots }) {
    return () => (slots.default ? slots.default() : null)
  },
})