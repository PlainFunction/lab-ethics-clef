// Workers provides node:async_hooks under the nodejs_compat flag. Declared here
// rather than pulling in @types/node, which clashes with the Workers types.
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, fn: () => R): R
    getStore(): T | undefined
  }
}
