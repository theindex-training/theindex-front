// @ts-check
// Mirrors theindex-api's eslint.config.mjs (ESLint flat config, type-checked typescript-eslint,
// Prettier as an ESLint rule), plus angular-eslint for components and templates.
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/',
      '.angular/',
      'out-tsc/',
      'playwright-report/',
      'test-results/',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      // Same relaxations as theindex-api.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': [
        'warn',
        {
          // Pages navigate and move on; the router reports navigation errors itself.
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: '@angular/router',
              name: ['navigate', 'navigateByUrl'],
            },
          ],
        },
      ],
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // House patterns (see CLAUDE.md): components set ChangeDetectionStrategy.Eager and inject
      // through the constructor. Moving to OnPush or inject() would be its own change.
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      '@angular-eslint/prefer-inject': 'off',
      // Flags `Validators.required` and friends, which are static and never use `this`.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Angular's test APIs are `any` by design (fixture.nativeElement, TestRequest.request.body).
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
      eslintPluginPrettierRecommended,
    ],
    rules: {
      'prettier/prettier': ['error', { parser: 'angular', endOfLine: 'auto' }],
    },
  },
);
