import { h } from 'vue'

await new Promise((resolve) => setTimeout(resolve, 2500))

export default function HeavyComponent(_: {}) {
  return h('h1', 'I am sooo heavy')
}
