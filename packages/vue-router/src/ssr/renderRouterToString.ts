import { makeSsrSerovalPlugin } from '@tanstack/router-core'
import type { AnyRouter } from '@tanstack/router-core'
import { createSSRApp, defineComponent } from 'vue'
import { renderToString as vueRenderToString } from '@vue/server-renderer'

type ChildrenFn = () => any

export const renderRouterToString = async ({
  router,
  responseHeaders,
  children,
}: {
  router: AnyRouter
  responseHeaders: Headers
  children: ChildrenFn
}) => {
  try {
    // Collect (optional) serialization adapters from the router config
    const serializationAdapters =
      (router.options as any)?.serializationAdapters ||
      (router.options.ssr as any)?.serializationAdapters

    const serovalPlugins =
      serializationAdapters?.map((adapter: any) =>
        makeSsrSerovalPlugin(adapter, { didRun: false }),
      ) ?? []

    // Expose seroval plugins for any code that reads them at SSR time.
    // Vue's renderer doesn't take a "plugins" option like Solid, so we attach them globally.
    ;(globalThis as any).__SEROVAL_PLUGINS__ = serovalPlugins

    // Root component simply renders the provided children()
    const Root = defineComponent({
      name: 'RouterSsrRoot',
      setup() {
        // Provide nonce (if any) for downstream consumers that might read it
        const nonce = router.options.ssr?.nonce
        // Consumers can inject('nonce') if needed
        return () => children()
      },
    })

    const app = createSSRApp(Root)

    // If you need the nonce in child components, provide it here.
    if (router.options.ssr?.nonce) {
      app.provide('nonce', router.options.ssr.nonce)
    }

    // Render to HTML string
    let html = await vueRenderToString(app)

    // Signal SSR completed for the router and gather injected HTML chunks
    router.serverSsr!.setRenderFinished()
    const injectedHtml = await Promise.all(router.serverSsr!.injectedHtml).then(
      (htmls) => htmls.join(''),
    )

    // Inject HTML right before </body>
    html = html.replace('</body>', `${injectedHtml}</body>`)

    return new Response(`<!DOCTYPE html>${html}`, {
      status: router.state.statusCode,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Render to string error:', error)
    return new Response('Internal Server Error', {
      status: 500,
      headers: responseHeaders,
    })
  }
}
