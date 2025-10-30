import type { InjectionKey } from 'vue'

export type MatchAccessor = () => string | undefined

export const matchContext = Symbol('matchContext') as InjectionKey<MatchAccessor>

export const dummyMatchContext = Symbol('dummyMatchContext') as InjectionKey<MatchAccessor>
