import * as Vue from 'vue'

import {
  deepEqual,
  exactPathTest,
  functionalUpdate,
  preloadWarning,
  removeTrailingSlash,
} from '@tanstack/router-core'
import { useRouterState } from './useRouterState'
import { useRouter } from './useRouter'

import { useIntersectionObserver } from './utils'

import type {
  AnyRouter,
  Constrain,
  LinkCurrentTargetElement,
  LinkOptions,
  RegisteredRouter,
  RoutePaths,
} from '@tanstack/router-core'
import type {
  ValidateLinkOptions,
  ValidateLinkOptionsArray,
} from './typePrimitives'

// ---- helpers (Vue equivalents) ------------------------------------------------

function mergeRefsVue<T extends Element>(
  ...refs: Array<Vue.Ref<T | null> | ((el: T | null) => void) | undefined>
) {
  return (el: T | null) => {
    for (const r of refs) {
      if (!r) continue
      if (typeof r === 'function') r(el)
      else (r as Vue.Ref<T | null>).value = el
    }
  }
}

function isCtrlEvent(e: MouseEvent) {
  return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
}

function composeHandlers<T extends Event>(
  ...handlers: Array<((e: T) => any) | undefined>
) {
  return (e: T) => {
    for (const h of handlers) h?.(e)
  }
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const k of keys) if (k in obj) (out[k] = obj[k])
  return out
}

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const out = { ...obj }
  for (const k of keys) delete (out as any)[k]
  return out
}

// ---- useLinkProps (Vue) -------------------------------------------------------

export function useLinkProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string = '',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '',
>(
  options: UseLinkPropsOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
): Record<string, any> {
  const router = useRouter()
  const isTransitioning = Vue.ref(false)
  let hasRenderFetched = false

  // Defaults like Solid.mergeProps
  const withDefaults = {
    activeProps: options.activeProps ?? (() => ({ class: 'active' })),
    inactiveProps: options.inactiveProps ?? (() => ({})),
    ...options,
  }

  const knownKeys = [
    'activeProps',
    'inactiveProps',
    'activeOptions',
    'to',
    'preload',
    'preloadDelay',
    'hashScrollIntoView',
    'replace',
    'startTransition',
    'resetScroll',
    'viewTransition',
    'target',
    'disabled',
    'style',
    'class',
    'onClick',
    'onFocus',
    'onMouseEnter',
    'onMouseLeave',
    'onMouseOver',
    'onMouseOut',
    'onTouchStart',
    'ignoreBlocker',
    // router link option keys we omit from spread
    'params',
    'search',
    'hash',
    'state',
    'mask',
    'reloadDocument',
    'unsafeRelative',
    'ref',
  ] as const

  const elementOnlyOmit = [
    'params',
    'search',
    'hash',
    'state',
    'mask',
    'reloadDocument',
    'unsafeRelative',
  ] as const

  const local = pick(withDefaults as any, knownKeys as any) as any
  const propsSafeToSpread = omit(
    omit(withDefaults as any, elementOnlyOmit as any),
    knownKeys as any,
  )

  const currentSearch = useRouterState({
    select: (s) => s.location.searchStr,
  })

  const from = (options as any).from

  const _options = () => ({
    ...options,
    from,
  })

  const next = Vue.computed(() => {
    // ensure we recompute when search changes like Solid's memo
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    currentSearch.value
    return router.buildLocation(_options() as any)
  })

  const hrefOption = Vue.computed<undefined | { href: string; external: boolean }>(() => {
    if (_options().disabled) return undefined
    let href: string
    const masked = next.value.maskedLocation
    if (masked) href = masked.url
    else href = next.value.url

    let external = false
    if (router.origin) {
      if (href.startsWith(router.origin)) {
        href = router.history.createHref(href.replace(router.origin, ''))
      } else {
        external = true
      }
    }
    return { href, external }
  })

  const externalLink = Vue.computed<string | undefined>(() => {
    const _href = hrefOption.value
    if (_href?.external) return _href.href
    try {
      new URL((_options() as any).to)
      return (_options() as any).to
    } catch {}
    return undefined
  })

  const preload = Vue.computed(() => {
    if ((_options() as any).reloadDocument || externalLink.value) return false
    return local.preload ?? router.options.defaultPreload
  })
  const preloadDelay = () =>
    local.preloadDelay ?? router.options.defaultPreloadDelay ?? 0

  const isActive = useRouterState({
    select: (s) => {
      if (externalLink.value) return false

      if (local.activeOptions?.exact) {
        const testExact = exactPathTest(
          s.location.pathname,
          next.value.pathname,
          router.basepath,
        )
        if (!testExact) return false
      } else {
        const currentPathSplit = removeTrailingSlash(
          s.location.pathname,
          router.basepath,
        ).split('/')

        const nextPathSplit = removeTrailingSlash(
          next.value?.pathname,
          router.basepath,
        )?.split('/')

        const pathIsFuzzyEqual = nextPathSplit?.every(
          (d, i) => d === currentPathSplit[i],
        )
        if (!pathIsFuzzyEqual) return false
      }

      if (local.activeOptions?.includeSearch ?? true) {
        const searchTest = deepEqual(s.location.search, next.value.search, {
          partial: !local.activeOptions?.exact,
          ignoreUndefined: !local.activeOptions?.explicitUndefined,
        })
        if (!searchTest) return false
      }

      if (local.activeOptions?.includeHash) {
        return s.location.hash === next.value.hash
      }

      return true
    },
  })

  const doPreload = () =>
    router.preloadRoute(_options() as any).catch((err: any) => {
      console.warn(err)
      console.warn(preloadWarning)
    })

  // viewport preload
  const elRef = Vue.ref<Element | null>(null)
  const preloadViewportIoCallback = (entry: IntersectionObserverEntry | undefined) => {
    if (entry?.isIntersecting) doPreload()
  }

  useIntersectionObserver(
    elRef,
    preloadViewportIoCallback,
    { rootMargin: '100px' },
    { disabled: !!local.disabled || !(preload.value === 'viewport') },
  )

  // render preload (once)
  Vue.watchEffect(() => {
    if (hasRenderFetched) return
    if (!local.disabled && preload.value === 'render') {
      doPreload()
      hasRenderFetched = true
    }
  })

  // External link props
  if (externalLink.value) {
    const ext = externalLink.value
    const base = pick(local, [
      'target',
      'disabled',
      'style',
      'class',
      'onClick',
      'onFocus',
      'onMouseEnter',
      'onMouseLeave',
      'onMouseOut',
      'onMouseOver',
      'onTouchStart',
    ] as any)

    return {
      ...propsSafeToSpread,
      ref: mergeRefsVue(elRef, (options as any).ref),
      href: ext,
      ...base,
    }
  }

  // Navigation handlers
  const handleClick = (e: MouseEvent) => {
    const elementTarget = (e.currentTarget as HTMLAnchorElement).target
    const effectiveTarget =
      local.target !== undefined ? local.target : elementTarget

    if (
      !local.disabled &&
      !isCtrlEvent(e) &&
      !e.defaultPrevented &&
      (!effectiveTarget || effectiveTarget === '_self') &&
      e.button === 0
    ) {
      e.preventDefault()

      isTransitioning.value = true
      const unsub = router.subscribe('onResolved', () => {
        unsub()
        isTransitioning.value = false
      })

      router.navigate({
        ..._options(),
        replace: local.replace,
        resetScroll: local.resetScroll,
        hashScrollIntoView: local.hashScrollIntoView,
        startTransition: local.startTransition,
        viewTransition: local.viewTransition,
        ignoreBlocker: local.ignoreBlocker,
      })
    }
  }

  const handleFocus = (_: MouseEvent) => {
    if (local.disabled) return
    if (preload.value) doPreload()
  }

  const handleTouchStart = handleFocus

  const handleEnter = (e: MouseEvent) => {
    if (local.disabled) return
    const eventTarget = (e.currentTarget || {}) as LinkCurrentTargetElement

    if (preload.value) {
      if (eventTarget.preloadTimeout) return
      eventTarget.preloadTimeout = setTimeout(() => {
        eventTarget.preloadTimeout = null
        doPreload()
      }, preloadDelay())
    }
  }

  const handleLeave = (e: MouseEvent) => {
    if (local.disabled) return
    const eventTarget = (e.currentTarget || {}) as LinkCurrentTargetElement
    if (eventTarget.preloadTimeout) {
      clearTimeout(eventTarget.preloadTimeout)
      eventTarget.preloadTimeout = null
    }
  }

  // Resolve active/inactive props
  const resolvedActiveProps = () =>
    isActive.value ? functionalUpdate(local.activeProps as any, {}) ?? {} : {}

  const resolvedInactiveProps = () =>
    isActive.value ? {} : functionalUpdate(local.inactiveProps as any, {})

  const resolvedClassName = Vue.computed(() =>
    [local.class, (resolvedActiveProps() as any).class, (resolvedInactiveProps() as any).class]
      .filter(Boolean)
      .join(' '),
  )

  const resolvedStyle = Vue.computed(() => ({
    ...(local.style ?? {}),
    ...(resolvedActiveProps() as any).style,
    ...(resolvedInactiveProps() as any).style,
  }))

  // Final props object (to spread on <a>)
  const finalProps: Record<string, any> = {
    ...propsSafeToSpread,
    ...resolvedActiveProps(),
    ...resolvedInactiveProps(),
    href: hrefOption.value?.href,
    ref: mergeRefsVue(elRef, (options as any).ref),
    onClick: composeHandlers(local.onClick as any, handleClick as any),
    onFocus: composeHandlers(local.onFocus as any, handleFocus as any),
    onMouseenter: composeHandlers(
      (local as any).onMouseenter ?? (local as any).onMouseEnter,
      handleEnter as any,
    ),
    onMouseover: composeHandlers(
      (local as any).onMouseover ?? (local as any).onMouseOver,
      handleEnter as any,
    ),
    onMouseleave: composeHandlers(
      (local as any).onMouseleave ?? (local as any).onMouseLeave,
      handleLeave as any,
    ),
    onMouseout: composeHandlers(
      (local as any).onMouseout ?? (local as any).onMouseOut,
      handleLeave as any,
    ),
    onTouchstart: composeHandlers(local.onTouchStart as any, handleTouchStart as any),
    disabled: !!local.disabled,
    target: local.target,
  }

  const styleObj = resolvedStyle.value
  if (styleObj && Object.keys(styleObj).length) finalProps.style = styleObj
  const cls = resolvedClassName.value
  if (cls) finalProps.class = cls

  if (local.disabled) {
    finalProps.role = 'link'
    finalProps['aria-disabled'] = true
  }
  if (isActive.value) {
    finalProps['data-status'] = 'active'
    finalProps['aria-current'] = 'page'
  }
  if (isTransitioning.value) {
    finalProps['data-transitioning'] = 'transitioning'
  }

  return finalProps
}

// ---- Types (ported; keep API surface) -----------------------------------------

export type UseLinkPropsOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '.',
> = ActiveLinkOptions<'a', TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  Omit<Record<string, any>, 'style'> & { style?: Record<string, any> }

export type ActiveLinkOptions<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = LinkOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  ActiveLinkOptionProps<TComp>

type ActiveLinkProps<TComp> = Partial<
  LinkComponentVueProps<TComp> & {
    [key: `data-${string}`]: unknown
  }
>

export interface ActiveLinkOptionProps<TComp = 'a'> {
  activeProps?: ActiveLinkProps<TComp> | (() => ActiveLinkProps<TComp>)
  inactiveProps?: ActiveLinkProps<TComp> | (() => ActiveLinkProps<TComp>)
}

export type LinkProps<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = ActiveLinkOptions<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & LinkPropsChildren

export interface LinkPropsChildren {
  children?:
    | Vue.VNodeChild
    | ((state: { isActive: boolean; isTransitioning: boolean }) => Vue.VNodeChild)
}

type LinkComponentVueProps<TComp> =
  TComp extends any ? Omit<Record<string, any>, keyof CreateLinkProps> : never

export type LinkComponentProps<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = LinkComponentVueProps<TComp> &
  LinkProps<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>

export type CreateLinkProps = LinkProps<any, any, string, string, string, string>

export type LinkComponent<
  in out TComp,
  in out TDefaultFrom extends string = string,
> = <
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = TDefaultFrom,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(
  props: LinkComponentProps<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
) => Vue.VNodeChild

export interface LinkComponentRoute<in out TDefaultFrom extends string = string> {
  defaultFrom: TDefaultFrom
  <
    TRouter extends AnyRouter = RegisteredRouter,
    const TTo extends string | undefined = undefined,
    const TMaskTo extends string = '',
  >(
    props: LinkComponentProps<
      'a',
      TRouter,
      this['defaultFrom'],
      TTo,
      this['defaultFrom'],
      TMaskTo
    >,
  ): Vue.VNodeChild
}

// ---- createLink & Link (Vue) --------------------------------------------------

export function createLink<const TComp>(
  Comp: Constrain<TComp, any, (props: CreateLinkProps) => any>,
): LinkComponent<TComp> {
  // Return a Vue component that renders Comp with link props
  const C = Vue.defineComponent({
    name: 'CreatedLink',
    props: {
      children: { type: [Function, Object] as any, required: false },
    },
    setup(props, { attrs, slots }) {
      const linkProps = useLinkProps(attrs as any)
      const state = Vue.computed(() => ({
        isActive: (linkProps as any)['data-status'] === 'active',
        isTransitioning: (linkProps as any)['data-transitioning'] === 'transitioning',
      }))

      const dyn = Vue.resolveDynamicComponent(Comp as any)
      return () =>
        Vue.h(
          dyn as any,
          linkProps,
          props.children
            ? (typeof props.children === 'function'
                ? (props.children as any)(state.value)
                : props.children)
            : slots.default?.(state.value),
        )
    },
  })
  // satisfy the declared type
  return (C as unknown) as any
}

export const Link: LinkComponent<'a'> = (props: any) => {
  // Implement as a real Vue component so TSX/JSX or h() both work
  const Comp = Vue.defineComponent({
    name: 'Link',
    props: {
      _asChild: { type: [String, Object, Function] as any, required: false },
      children: { type: [Function, Object] as any, required: false },
    },
    setup(p, { attrs, slots }) {
      const asChild = (p as any)._asChild
      const linkProps = useLinkProps(attrs as any)

      const state = Vue.computed(() => ({
        isActive: (linkProps as any)['data-status'] === 'active',
        isTransitioning: (linkProps as any)['data-transitioning'] === 'transitioning',
      }))

      const Dyn = Vue.resolveDynamicComponent(asChild ? (asChild as any) : 'a')
      const childrenVNode =
        typeof (p as any).children === 'function'
          ? (p as any).children(state.value)
          : (p as any).children ?? slots.default?.(state.value)

      return () => Vue.h(Dyn as any, linkProps, childrenVNode)
    },
  })
  return Vue.h(Comp as any, props)
}

// ---- linkOptions passthrough --------------------------------------------------

export type LinkOptionsFnOptions<
  TOptions,
  TComp,
  TRouter extends AnyRouter = RegisteredRouter,
> = TOptions extends ReadonlyArray<any>
  ? ValidateLinkOptionsArray<TRouter, TOptions, string, TComp>
  : ValidateLinkOptions<TRouter, TOptions, string, TComp>

export type LinkOptionsFn<TComp> = <
  const TOptions,
  TRouter extends AnyRouter = RegisteredRouter,
>(
  options: LinkOptionsFnOptions<TOptions, TComp, TRouter>,
) => TOptions

export const linkOptions: LinkOptionsFn<'a'> = (options) => options as any
