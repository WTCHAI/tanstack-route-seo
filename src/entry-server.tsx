// src/entry-server.tsx - SIMPLIFIED VERSION
import {
  RouterServer,
  createRequestHandler,
  renderRouterToStream,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'
import './fetch-polyfill'

export async function render(pathname: string, viteHead: string = '') {
  try {
    const url = `http://localhost:3000${pathname}`
    const request = new Request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/html',
      },
    })

    const handler = createRequestHandler({
      request,
      createRouter: () => {
        const router = createRouter()

        if (viteHead) {
          router.update({
            context: {
              ...router.options.context,
              head: viteHead,
            },
          })
        }

        return router
      },
    })

    const response = await handler(({ request, responseHeaders, router }) =>
      renderRouterToStream({
        request,
        responseHeaders,
        router,
        children: <RouterServer router={router} />,
      })
    )

    // Get HTML as string
    const html = await response.text()

    return {
      html,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    }
  } catch (error) {
    console.error('❌ SSR Render Error:', error)
    return {
      html: `<html><body><h1>SSR Error</h1><pre>${error instanceof Error ? error.stack : 'Unknown error'}</pre></body></html>`,
      statusCode: 500,
      headers: { 'content-type': 'text/html' },
    }
  }
}
