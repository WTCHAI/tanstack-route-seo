// Removed pipeline import - using direct stream handling instead
import {
  RouterServer,
  createRequestHandler,
  renderRouterToStream,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'
import './fetch-polyfill'

export async function render({
  req,
  res,
  head,
}: {
  head: string
  req: any
  res: any
}) {
  // Convert the express request to a fetch request
  const url = new URL(req.originalUrl || req.url, 'https://localhost:5173').href

  const request = new Request(url, {
    method: req.method,
    headers: (() => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        headers.set(key, value as any)
      }
      return headers
    })(),
  })

  // Create a request handler
  const handler = createRequestHandler({
    request,
    createRouter: () => {
      const router = createRouter()

      // Update each router instance with the head info from vite
      router.update({
        context: {
          ...router.options.context,
          head: head,
        },
      })
      return router
    },
  })

  // Let's use the default stream handler to create the response
  const response = await handler(({ request, responseHeaders, router }) =>
    renderRouterToStream({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    })
  )

  // Convert the fetch response back to an express response
  res.statusMessage = response.statusText
  res.status(response.status)

  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  // Read the response body as text
  const html = await response.text()
  return html
}
