import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

// Testing Library must load after the DOM globals exist, hence the dynamic imports.
const { afterEach, expect } = await import('bun:test')
const { cleanup } = await import('@testing-library/react')
const matchers = await import('@testing-library/jest-dom/matchers')

// The module has only named exports at runtime; its `export =` typing adds a phantom `default`.
expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0])
afterEach(() => cleanup())
