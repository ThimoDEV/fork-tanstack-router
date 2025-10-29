import {
  defineComponent,
  h,
  onErrorCaptured,
  PropType,
  ref,
  VNodeChild,
  watch,
} from 'vue'
import { ErrorRouteComponent } from './route'
import { ErrorComponentProps } from '@tanstack/router-core'

export const CatchBoundary = defineComponent({
     name: 'CatchBoundary',
      props: {
        getResetKey: {
          type: Function as PropType<() => number | string>,
          required: true,
        },
        errorComponent: {
          type: [Function, Object] as PropType<ErrorRouteComponent>,
          required: false,
        },
        onCatch: {
          type: Function as PropType<(error: Error) => void>,
          required: false,
        },
      },
      setup(props, { slots }) {
        const error = ref<Error | null>(null)
    
        const reset = () => {
          error.value = null
        }
    
        // Capture errors from descendants
        onErrorCaptured((err) => {
          const e = err instanceof Error ? err : new Error(String(err))
          error.value = e
          props.onCatch?.(e)
          // Prevent upward propagation (similar to handling within the boundary)
          return false
        })
    
        // Reset when the external reset key changes (deferred in Solid; here a straight watch)
        watch(
          () => props.getResetKey(),
          () => reset(),
        )
    
        return () => {
          if (error.value) {
            const Comp = props.errorComponent ?? ErrorComponent
            return h(Comp as any, {
              error: error.value,
              reset,
            })
          }
    
          return slots.default ? slots.default() : null
        }
      },
    })

export const ErrorComponent: ErrorRouteComponent = Object.assign(
  (props: ErrorComponentProps): VNodeChild => {
    const show = ref( process.env.NODE_ENV !== 'production')

    return h('div', { style: { padding: '.5rem', maxWidth: '100%' } }, [
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '.5rem',
          },
        },
        [
          h('strong', { style: { fontSize: '1rem' } }, 'Something went wrong!'),
          h(
            'button',
            {
              style: {
                appearance: 'none',
                fontSize: '.6em',
                border: '1px solid currentColor',
                padding: '.1rem .2rem',
                fontWeight: 'bold',
                borderRadius: '.25rem',
              },
              onClick: () => (show.value = !show.value),
            },
            show.value ? 'Hide Error' : 'Show Error',
          ),
        ],
      ),
      h('div', { style: { height: '.25rem' } }),
      show.value
        ? h(
            'div',
            null,
            h(
              'pre',
              {
                style: {
                  fontSize: '.7em',
                  border: '1px solid red',
                  borderRadius: '.25rem',
                  padding: '.3rem',
                  color: 'red',
                  overflow: 'auto',
                },
              },
              props.error?.message ? h('code', null, String(props.error.message)) : undefined,
            ),
          )
        : null,
    ])
  },
  { name: 'ErrorComponent' },
)
    