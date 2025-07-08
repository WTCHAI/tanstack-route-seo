import { Buffer } from 'buffer'
import path from 'node:path'

import { staticPlugin } from '@elysiajs/static'
import { Elysia } from 'elysia'
import getPort, { portNumbers } from 'get-port'

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === 'production',
  hmrPort
) {
  const app = new Elysia()

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite
  if (!isProd) {
    vite = await (
      await import('vite')
    ).createServer({
      root,
      logLevel: isTest ? 'error' : 'info',
      server: {
        middlewareMode: true,
        watch: {
          // During tests we edit the files too fast and sometimes chokidar
          // misses change events, so enforce polling for consistency
          usePolling: true,
          interval: 100,
        },
        hmr: {
          port: hmrPort,
        },
      },
      appType: 'custom',
    })
    // Handle Vite dev server requests using onRequest hook
    app.onRequest(async ({ request, set }) => {
      const url = new URL(request.url)

      // Check if this is a Vite dev server asset request
      if (
        url.pathname.startsWith('/@') ||
        url.pathname.startsWith('/src/') ||
        url.pathname.startsWith('/node_modules/') ||
        url.pathname.includes('?') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.ts') ||
        url.pathname.endsWith('.tsx') ||
        url.pathname.endsWith('.jsx') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.scss') ||
        url.pathname.endsWith('.sass') ||
        url.pathname.endsWith('.less') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.gif') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.woff') ||
        url.pathname.endsWith('.woff2') ||
        url.pathname.endsWith('.ttf') ||
        url.pathname.endsWith('.eot')
      ) {
        // Create a complete Node.js-style request object for Vite
        const nodeReq = {
          url: url.pathname + url.search,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          httpVersion: '1.1',
          httpVersionMajor: 1,
          httpVersionMinor: 1,
          complete: true,
          connection: { encrypted: false },
          socket: { encrypted: false },
        }

        // Create a complete Node.js response object for Vite middleware
        let responseData = Buffer.alloc(0)
        let responseHeaders = {}
        let statusCode = 200
        let finished = false
        const listeners = {}

        const nodeRes = {
          statusCode,
          headers: responseHeaders,
          finished,
          headersSent: false,
          writable: true,
          writableEnded: false,
          writableFinished: false,

          // Core response methods
          setHeader: (name, value) => {
            responseHeaders[name] = value
          },
          getHeader: (name) => {
            return responseHeaders[name]
          },
          getHeaders: () => {
            return { ...responseHeaders }
          },
          removeHeader: (name) => {
            delete responseHeaders[name]
          },
          hasHeader: (name) => {
            return name in responseHeaders
          },
          writeHead: (code, reasonPhrase, headers) => {
            if (typeof reasonPhrase === 'object') {
              headers = reasonPhrase
              reasonPhrase = undefined
            }
            statusCode = code
            if (headers) Object.assign(responseHeaders, headers)
            nodeRes.headersSent = true
          },
          write: (chunk, encoding, callback) => {
            if (typeof encoding === 'function') {
              callback = encoding
              encoding = 'utf8'
            }
            if (typeof chunk === 'string') {
              chunk = Buffer.from(chunk, encoding || 'utf8')
            }
            responseData = Buffer.concat([responseData, chunk])
            if (callback) callback()
            return true
          },
          end: (data, encoding, callback) => {
            if (typeof data === 'function') {
              callback = data
              data = undefined
            }
            if (typeof encoding === 'function') {
              callback = encoding
              encoding = 'utf8'
            }
            if (data) {
              if (typeof data === 'string') {
                data = Buffer.from(data, encoding || 'utf8')
              }
              responseData = Buffer.concat([responseData, data])
            }
            finished = true
            nodeRes.writableEnded = true
            nodeRes.writableFinished = true

            // Apply to Elysia response
            set.status = statusCode
            Object.entries(responseHeaders).forEach(([key, value]) => {
              set.headers[key] = value
            })

            if (callback) callback()
            return responseData.toString()
          },

          // EventEmitter methods that Vite middleware expects
          on: (event, listener) => {
            if (!listeners[event]) listeners[event] = []
            listeners[event].push(listener)
            return nodeRes
          },
          once: (event, listener) => {
            const onceListener = (...args) => {
              listener(...args)
              nodeRes.removeListener(event, onceListener)
            }
            return nodeRes.on(event, onceListener)
          },
          emit: (event, ...args) => {
            const eventListeners = listeners[event]
            if (eventListeners) {
              eventListeners.forEach((listener) => listener(...args))
            }
            return eventListeners && eventListeners.length > 0
          },
          removeListener: (event, listener) => {
            const eventListeners = listeners[event]
            if (eventListeners) {
              const index = eventListeners.indexOf(listener)
              if (index > -1) {
                eventListeners.splice(index, 1)
              }
            }
            return nodeRes
          },
          removeAllListeners: (event) => {
            if (event) {
              delete listeners[event]
            } else {
              Object.keys(listeners).forEach((key) => delete listeners[key])
            }
            return nodeRes
          },

          // Additional methods for compatibility
          cork: () => {},
          uncork: () => {},
          destroy: () => {},
          flushHeaders: () => {},
          setTimeout: () => {},
        }

        // Handle the request through Vite
        return new Promise((resolve) => {
          vite.middlewares(nodeReq, nodeRes, () => {
            resolve(nodeRes.end())
          })
        })
      }
    })
  } else {
    // Add static file serving for production
    app.use(
      staticPlugin({
        assets: './dist/client',
        prefix: '/',
      })
    )
  }

  // In your server file - replace the SSR section with this:
  app.all('*', async ({ request, set }) => {
    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      // Skip non-HTML requests
      if (path.extname(pathname) !== '') {
        set.status = 404
        return `${pathname} is not valid router path`
      }

      // Get Vite head injection for development
      let viteHead = ''
      if (!isProd) {
        const htmlTemplate = await vite.transformIndexHtml(
          pathname,
          `<html><head></head><body></body></html>`
        )
        const headStart = htmlTemplate.indexOf('<head>') + 6
        const headEnd = htmlTemplate.indexOf('</head>')
        viteHead = htmlTemplate.substring(headStart, headEnd)
      }

      // Load the entry server module
      const entry = !isProd
        ? await vite.ssrLoadModule('/src/entry-server.tsx')
        : await import('./dist/server/entry-server.js')

      console.info('Rendering:', pathname)

      // FIXED: Call render function directly
      const result = await entry.render(pathname, viteHead)

      // Handle result
      if (typeof result === 'string') {
        set.headers['content-type'] = 'text/html'
        return result
      } else if (result && typeof result.html === 'string') {
        set.status = result.statusCode || 200
        set.headers['content-type'] = 'text/html'

        // Apply any additional headers
        if (result.headers) {
          Object.entries(result.headers).forEach(([key, value]) => {
            set.headers[key] = value
          })
        }

        return result.html
      } else {
        throw new Error(`Invalid SSR result: ${typeof result}`)
      }
    } catch (e) {
      !isProd && vite?.ssrFixStacktrace(e)
      console.error('SSR Error:', e.stack)
      set.status = 500
      return `<html><body><h1>500 - Internal Server Error</h1><pre>${e.stack}</pre></body></html>`
    }
  })

  return { app, vite }
}

if (!isTest) {
  createServer().then(async ({ app }) =>
    app.listen(await getPort({ port: portNumbers(3000, 3100) }), () => {
      console.info('Client Server: http://localhost:3000')
    })
  )
}
