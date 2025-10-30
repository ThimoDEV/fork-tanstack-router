import { isbot } from 'isbot'
import { transformReadableStreamWithRouter } from '@tanstack/router-core/ssr/server'
import { makeSsrSerovalPlugin } from '@tanstack/router-core'
import type { AnyRouter } from '@tanstack/router-core'
import { createSSRApp, defineComponent } from 'vue'
import {
	renderToString as vueRenderToString,
	renderToWebStream,
} from '@vue/server-renderer'

type ChildrenFn = () => any

export const renderRouterToStream = async ({
	request,
	router,
	responseHeaders,
	children,
}: {
	request: Request
	router: AnyRouter
	responseHeaders: Headers
	children: ChildrenFn
}) => {
	// We'll create a TransformStream to prepend the doctype and then pipe Vue's web stream into it
	const { writable, readable } = new TransformStream()

	const docType = '<!DOCTYPE html>'

	// Collect (optional) serialization adapters from the router config
	const serializationAdapters =
		(router.options as any)?.serializationAdapters ||
		(router.options.ssr as any)?.serializationAdapters

	const serovalPlugins =
		serializationAdapters?.map((adapter: any) =>
			makeSsrSerovalPlugin(adapter, { didRun: false }),
		) ?? []

	// Vue's renderer doesn't take a "plugins" option like Solid, so we attach them globally.
	;(globalThis as any).__SEROVAL_PLUGINS__ = serovalPlugins

	// Root component simply renders the provided children()
	const Root = defineComponent({
		name: 'RouterSsrRoot',
		setup() {
			return () => children()
		},
	})

	const app = createSSRApp(Root)

	// Provide nonce (if any) for downstream consumers
	if (router.options.ssr?.nonce) {
		app.provide('nonce', router.options.ssr.nonce)
	}

	// For bots, render the full HTML string for better SEO and avoid partial streams
	if (isbot(request.headers.get('User-Agent'))) {
		try {
			let html = await vueRenderToString(app)

			// Signal SSR completed and collect injected HTML chunks
			router.serverSsr!.setRenderFinished()
			const injectedHtml = await Promise.all(
				router.serverSsr!.injectedHtml,
			).then((htmls) => htmls.join(''))

			html = html.replace('</body>', `${injectedHtml}</body>`)

			return new Response(`${docType}${html}`, {
				status: router.state.statusCode,
				headers: responseHeaders,
			})
		} catch (error) {
			console.error('Vue SSR renderToString (bot) error:', error)
			return new Response('Internal Server Error', {
				status: 500,
				headers: responseHeaders,
			})
		}
	}

	// Streaming path for normal clients
		let vueStream: ReadableStream
	try {
		vueStream = renderToWebStream(app) as unknown as ReadableStream
	} catch (error) {
		console.error('Vue SSR renderToWebStream error:', error)
		return new Response('Internal Server Error', {
			status: 500,
			headers: responseHeaders,
		})
	}

	// Prepend <!DOCTYPE html> as the very first chunk
	const encoder = new TextEncoder()
	const writer = writable.getWriter()
	await writer.write(encoder.encode(docType))
	writer.releaseLock()

	// Pipe Vue's ReadableStream into our writable
		vueStream
			.pipeTo(writable)
		.catch((err: any) => console.error('Vue SSR pipeTo error:', err))

		const responseStream = transformReadableStreamWithRouter(router, readable as any)

	return new Response(responseStream as any, {
		status: router.state.statusCode,
		headers: responseHeaders,
	})
}

