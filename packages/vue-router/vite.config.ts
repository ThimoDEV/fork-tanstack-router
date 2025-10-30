import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/config/vite'
import vue from '@vitejs/plugin-vue'
import packageJson from './package.json'
import type { ViteUserConfig } from 'vitest/config'

const config = defineConfig(({ mode }) => {
  if (mode === 'server') {
    return {
      plugins: [vue()] as ViteUserConfig['plugins'],
      test: {
        name: `${packageJson.name} (server)`,
        dir: './tests/server',
        watch: false,
        environment: 'node',
        typecheck: { enabled: true },
      },
    }
  }

  return {
    plugins: [vue()] as ViteUserConfig['plugins'],
    test: {
      name: packageJson.name,
      dir: './tests',
      exclude: ['server'],
      watch: false,
      environment: 'jsdom',
      typecheck: { enabled: true },
      setupFiles: ['./tests/setupTests.ts'],
    },
  }
})

export default defineConfig((env) =>
  mergeConfig(
    config(env),
    tanstackViteConfig({
      entry: ['./src/index.ts', './src/ssr/client.ts', './src/ssr/server.ts'],
      srcDir: './src',
    }),
  ),
)
