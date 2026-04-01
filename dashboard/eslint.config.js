import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-server', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Ban direct useEffect usage — use useMountEffect or derived state instead
      // Note: no-restricted-imports is not used because it false-positives on `import * as React`
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='useEffect'][parent.source.value='react']",
          message:
            'Named import of useEffect is banned. Use derived state, event handlers, or useMountEffect() instead.',
        },
        {
          selector: "CallExpression[callee.name='useEffect']",
          message:
            'Direct use of useEffect is banned. Use derived state, event handlers, or useMountEffect() instead.',
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useEffect']",
          message:
            'Direct use of React.useEffect is banned. Use derived state, event handlers, or useMountEffect() instead.',
        },
      ],
    },
  }
);
