import { ref, computed, watchEffect, onScopeDispose, defineComponent, h, type PropType, type Ref, type VNodeChild } from 'vue'
import { useRouter } from './useRouter'
import type {
  BlockerFnArgs,
  HistoryAction,
  HistoryLocation,
} from '@tanstack/history'
import type { VueNode } from './route'
import type {
  AnyRoute,
  AnyRouter,
  ParseRoute,
  RegisteredRouter,
} from '@tanstack/router-core'

interface ShouldBlockFnLocation<
  out TRouteId,
  out TFullPath,
  out TAllParams,
  out TFullSearchSchema,
> {
  routeId: TRouteId
  fullPath: TFullPath
  pathname: string
  params: TAllParams
  search: TFullSearchSchema
}

type AnyShouldBlockFnLocation = ShouldBlockFnLocation<any, any, any, any>
type MakeShouldBlockFnLocationUnion<
  TRouter extends AnyRouter = RegisteredRouter,
  TRoute extends AnyRoute = ParseRoute<TRouter['routeTree']>,
> = TRoute extends any
  ? ShouldBlockFnLocation<
      TRoute['id'],
      TRoute['fullPath'],
      TRoute['types']['allParams'],
      TRoute['types']['fullSearchSchema']
    >
  : never

type BlockerResolver<TRouter extends AnyRouter = RegisteredRouter> =
  | {
      status: 'blocked'
      current: MakeShouldBlockFnLocationUnion<TRouter>
      next: MakeShouldBlockFnLocationUnion<TRouter>
      action: HistoryAction
      proceed: () => void
      reset: () => void
    }
  | {
      status: 'idle'
      current: undefined
      next: undefined
      action: undefined
      proceed: undefined
      reset: undefined
    }

type ShouldBlockFnArgs<TRouter extends AnyRouter = RegisteredRouter> = {
  current: MakeShouldBlockFnLocationUnion<TRouter>
  next: MakeShouldBlockFnLocationUnion<TRouter>
  action: HistoryAction
}

export type ShouldBlockFn<TRouter extends AnyRouter = RegisteredRouter> = (
  args: ShouldBlockFnArgs<TRouter>,
) => boolean | Promise<boolean>
export type UseBlockerOpts<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
> = {
  shouldBlockFn: ShouldBlockFn<TRouter>
  enableBeforeUnload?: boolean | (() => boolean)
  disabled?: boolean
  withResolver?: TWithResolver
}

type LegacyBlockerFn = () => Promise<any> | any
type LegacyBlockerOpts = {
  blockerFn?: LegacyBlockerFn
  condition?: boolean | any
}

function _resolveBlockerOpts(
  opts?: UseBlockerOpts | LegacyBlockerOpts | LegacyBlockerFn,
  condition?: boolean | any,
): UseBlockerOpts {
  if (opts === undefined) {
    return {
      shouldBlockFn: () => true,
      withResolver: false,
    }
  }

  if ('shouldBlockFn' in opts) {
    return opts
  }

  if (typeof opts === 'function') {
    const shouldBlock = Boolean(condition ?? true)

    const _customBlockerFn = async () => {
      if (shouldBlock) return await opts()
      return false
    }

    return {
      shouldBlockFn: _customBlockerFn,
      enableBeforeUnload: shouldBlock,
      withResolver: false,
    }
  }

  const shouldBlock = computed(() => Boolean(opts.condition ?? true))

  const _customBlockerFn = async () => {
    if (shouldBlock.value && opts.blockerFn !== undefined) {
      return await opts.blockerFn()
    }
    return shouldBlock.value
  }

  return {
    get shouldBlockFn() {
      return _customBlockerFn
    },
    get enableBeforeUnload() {
      return shouldBlock.value
    },
    get withResolver() {
      return opts.blockerFn === undefined
    },
  }
}

export function useBlocker<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = false,
>(
  opts: UseBlockerOpts<TRouter, TWithResolver>,
): TWithResolver extends true ? Ref<BlockerResolver<TRouter>> : void

/**
 * @deprecated Use the shouldBlockFn property instead
 */
export function useBlocker(
  blockerFnOrOpts?: LegacyBlockerOpts,
): Ref<BlockerResolver>

/**
 * @deprecated Use the UseBlockerOpts object syntax instead
 */
export function useBlocker(
  blockerFn?: LegacyBlockerFn,
  condition?: boolean | any,
): Ref<BlockerResolver>

export function useBlocker(
  opts?: UseBlockerOpts | LegacyBlockerOpts | LegacyBlockerFn,
  condition?: boolean | any,
): Ref<BlockerResolver> | void {
   const normalized = _resolveBlockerOpts(opts as any, condition)
  const props = {
    enableBeforeUnload: true,
    disabled: false,
    withResolver: false,
    ...(normalized as any),
  } as UseBlockerOpts

  const router = useRouter()

  const resolver = ref<BlockerResolver>({
    status: 'idle',
    current: undefined,
    next: undefined,
    action: undefined,
    proceed: undefined,
    reset: undefined,
  })

  const stop = watchEffect((onInvalidate) => {
     const blockerFnComposed = async (blockerFnArgs: BlockerFnArgs) => {
          const getLocation = (location: HistoryLocation): AnyShouldBlockFnLocation => {
            const parsedLocation = router.parseLocation(location)
            const matchedRoutes = router.getMatchedRoutes(parsedLocation.pathname, undefined)
            if (matchedRoutes.foundRoute === undefined) {
              throw new Error(`No route found for location ${location.href}`)
            }
            return {
              routeId: matchedRoutes.foundRoute.id,
              fullPath: matchedRoutes.foundRoute.fullPath,
              pathname: parsedLocation.pathname,
              params: matchedRoutes.routeParams,
              search: parsedLocation.search,
            }
          }
    
          const current = getLocation(blockerFnArgs.currentLocation)
          const next = getLocation(blockerFnArgs.nextLocation)
    
          const shouldBlock = await (typeof props.shouldBlockFn === 'function'
            ? props.shouldBlockFn({ action: blockerFnArgs.action, current, next })
            : (props.shouldBlockFn as any)({ action: blockerFnArgs.action, current, next }))
    
          if (!props.withResolver) {
            return shouldBlock
          }
    
          if (!shouldBlock) {
            return false
          }
    
          const canNavigateAsync = await new Promise<boolean>((resolve) => {
            resolver.value = {
              status: 'blocked',
              current,
              next,
              action: blockerFnArgs.action,
              proceed: () => resolve(false),
              reset: () => resolve(true),
            }
          })
    
          resolver.value = {
            status: 'idle',
            current: undefined,
            next: undefined,
            action: undefined,
            proceed: undefined,
            reset: undefined,
          }
    
          return canNavigateAsync
        }

    const disposeBlock = props.disabled
      ? undefined
      : router.history.block({
          blockerFn: blockerFnComposed,
          enableBeforeUnload: props.enableBeforeUnload,
        })

     onInvalidate(() => {
      disposeBlock?.()
    })
  })

  onScopeDispose(() => stop())

  return resolver
}

const _resolvePromptBlockerArgs = (
  props: PromptProps | LegacyPromptProps,
): UseBlockerOpts => {
  if (typeof (props as any).shouldBlockFn === 'function') {
    return props as UseBlockerOpts
  }

  const legacy = props as LegacyPromptProps
  const shouldBlock = computed(() => Boolean(legacy.condition ?? true))

  const _customBlockerFn = async () => {
    if (shouldBlock.value && legacy.blockerFn !== undefined) {
      return await legacy.blockerFn()
    }
    return shouldBlock.value
  }

  return {
    shouldBlockFn: _customBlockerFn,
    get enableBeforeUnload() {
      return shouldBlock.value
    },
    get withResolver() {
      return legacy.blockerFn === undefined
    },
  }
}

export const Block = defineComponent({
  name: 'Block',
  props: {
    // Modern props (optional)
    shouldBlockFn: Function as PropType<ShouldBlockFn>,
    enableBeforeUnload: [Boolean, Function] as PropType<boolean | (() => boolean)>,
    disabled: Boolean,
    withResolver: Boolean,
    // Legacy props (optional)
    blockerFn: Function as PropType<LegacyBlockerFn>,
    condition: null as unknown as PropType<any>,
  },
  setup(props, { slots }) {
    const args = _resolvePromptBlockerArgs(props as any)
    const resolver = useBlocker(args) as Ref<BlockerResolver>

    // Slots:
    // - default slot receives `{ resolver }` to emulate "children is function" usage
    // - or render the raw default slot if consumer doesn't use props
    return () => {
      if (slots.default) {
        // Give resolver.value as slot prop (Vue style)
        return slots.default({ resolver: resolver.value })
      }
      return null
    }
  },
})

type LegacyPromptProps = {
  blockerFn?: LegacyBlockerFn
  condition?: boolean | any
  children?: VueNode | ((params: BlockerResolver) => VueNode)
}

type PromptProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
  TParams = TWithResolver extends true ? BlockerResolver<TRouter> : void,
> = UseBlockerOpts<TRouter, TWithResolver> & {
  children?: VueNode | ((params: TParams) => VueNode)
}
