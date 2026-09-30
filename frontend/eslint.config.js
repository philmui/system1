import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
 { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'src/lib/api.generated.ts'] },
 ...tseslint.configs.recommended,
 { files: ['**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser, ...globals.node } }, rules: { '@typescript-eslint/no-explicit-any': 'error' } },
 { files: ['**/*.mjs'], languageOptions: { globals: globals.node } }
);
