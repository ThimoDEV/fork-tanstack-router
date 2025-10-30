import { defineComponent, onMounted, useAttrs, type PropType } from 'vue'
import { useRouter } from './useRouter'
import type {
  AnyRouter,
  FromPathOption,
  NavigateOptions,
  RegisteredRouter,
  UseNavigateResult,
} from '@tanstack/router-core'

export function useNavigate<
  TRouter extends AnyRouter = RegisteredRouter,
  TDefaultFrom extends string = string,
>(_defaultOpts?: {
  from?: FromPathOption<TRouter, TDefaultFrom>
}): UseNavigateResult<TDefaultFrom> {
  const router = useRouter()

  return ((options: NavigateOptions) => {
    return router.navigate({
      ...options,
      from: options.from ?? _defaultOpts?.from,
    })
  }) as UseNavigateResult<TDefaultFrom>
}

export type NavigateProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>

export const Navigate = defineComponent<NavigateProps>({
  name: 'Navigate',
  // Keep it prop-less so attributes (to, from, replace, search, state, mask, etc.)
  // flow into `attrs` and we can forward them directly.
  props: {},
  setup(props) {
    const { navigate } = useRouter()

    onMounted(() => {
      // Forward all attributes as NavigateOptions
      // (Consumers can rely on the NavigateProps type if they need TS help)
      navigate(props as unknown as NavigateOptions)
    })

    return () => null
  },
})
