import vuePlugin from '@vitejs/plugin-vue'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    files: ['src/**/*.{ts,vue}', 'tests/**/*.{ts,vue}'],
    plugins: {
      vuePlugin: vuePlugin(),
    },
    rules: {
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
