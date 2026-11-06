import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'

// Tests use a plain React setup: the TanStack Start / devtools plugins in vite.config.ts
// load a second React copy under Vitest and break component tests ("Invalid hook call").
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
})
