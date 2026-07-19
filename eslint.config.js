import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Deliberate mixed exports: shadcn primitives export their cva variants
    // (button.tsx → buttonVariants) and each hook file pairs a provider
    // component with its hook (useAuth/useCoach/useTheme). The rule only
    // affects HMR granularity, not correctness.
    files: ['src/components/ui/**', 'src/hooks/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
