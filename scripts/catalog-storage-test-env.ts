/** Node-only test double for Web Locks. Browser concurrency checks always use the
 * real browser implementation; this only gives existing isolated Pinia checks
 * the production coordinator contract without an unsafe production fallback. */
export function installCatalogTestLocks() {
  const beforeNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const beforeSecure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext')
  const queues = new Map<string, Promise<unknown>>()
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: (name: string, _options: unknown, callback: () => unknown) => {
      const task = (queues.get(name) || Promise.resolve()).then(callback)
      queues.set(name, task.then(() => undefined, () => undefined))
      return task
    },
  } } })
  return () => {
    if (beforeNavigator) Object.defineProperty(globalThis, 'navigator', beforeNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
    if (beforeSecure) Object.defineProperty(globalThis, 'isSecureContext', beforeSecure)
    else Reflect.deleteProperty(globalThis, 'isSecureContext')
  }
}
