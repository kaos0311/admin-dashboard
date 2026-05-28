import { defineConfig, globalIgnores } from "eslint/config";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },

    rules: {
      /*
      |--------------------------------------------------------------------------
      | CORE JAVASCRIPT
      |--------------------------------------------------------------------------
      */

      "no-console": ["warn", { allow: ["warn", "error"] }],

      eqeqeq: ["error", "always"],

      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-return-await": "error",
      "no-unsafe-finally": "error",
      "no-debugger": "warn",
      "no-alert": "warn",

      "prefer-const": "warn",

      /*
      |--------------------------------------------------------------------------
      | UNUSED VARIABLES
      |--------------------------------------------------------------------------
      */

      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      /*
      |--------------------------------------------------------------------------
      | TYPESCRIPT
      |--------------------------------------------------------------------------
      */

      "@typescript-eslint/no-explicit-any": "warn",

      /*
        You had these OFF entirely.
        That’s fine short-term during refactors,
        but dangerous long-term in enterprise apps.
      */

      "@typescript-eslint/no-floating-promises": "warn",

      "@typescript-eslint/no-misused-promises": [
        "warn",
        {
          checksVoidReturn: false,
        },
      ],

      "@typescript-eslint/require-await": "off",

      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      "@typescript-eslint/consistent-type-exports": "warn",

      "@typescript-eslint/prefer-nullish-coalescing": "warn",

      "@typescript-eslint/prefer-optional-chain": "warn",

      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-ignore": "allow-with-description",
          minimumDescriptionLength: 6,
        },
      ],

      /*
      |--------------------------------------------------------------------------
      | REACT
      |--------------------------------------------------------------------------
      */

      "react/jsx-key": "error",

      "react-hooks/exhaustive-deps": "warn",

      "react/self-closing-comp": "warn",

      /*
      |--------------------------------------------------------------------------
      | NEXTJS
      |--------------------------------------------------------------------------
      */

      "@next/next/no-img-element": "warn",

      /*
      |--------------------------------------------------------------------------
      | IMPORTS
      |--------------------------------------------------------------------------
      */

      "sort-imports": [
        "warn",
        {
          ignoreDeclarationSort: true,
          ignoreCase: true,
        },
      ],

      /*
      |--------------------------------------------------------------------------
      | CODE QUALITY
      |--------------------------------------------------------------------------
      */

      curly: ["warn", "all"],

      "object-shorthand": ["warn", "always"],

      "prefer-template": "warn",

      "no-var": "error",

      /*
      |--------------------------------------------------------------------------
      | STYLISTIC SAFETY
      |--------------------------------------------------------------------------
      */

      "no-trailing-spaces": "warn",

      "eol-last": ["warn", "always"],

      "comma-dangle": [
        "warn",
        {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "never",
        },
      ],
    },
  },

  /*
  |--------------------------------------------------------------------------
  | CLOUD FUNCTIONS / SCRIPTS
  |--------------------------------------------------------------------------
  */

  {
    files: ["functions/**/*.{ts,js}", "scripts/**/*.{ts,js,mjs}"],

    rules: {
      "no-console": "off",

      /*
        Firebase Functions often use explicit any
        during request parsing and webhook handling.
      */
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  /*
  |--------------------------------------------------------------------------
  | TEST FILES
  |--------------------------------------------------------------------------
  */

  {
    files: [
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
    ],

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  /*
  |--------------------------------------------------------------------------
  | GLOBAL IGNORES
  |--------------------------------------------------------------------------
  */

  globalIgnores([
    /*
    |--------------------------------------------------------------------------
    | NEXT
    |--------------------------------------------------------------------------
    */

    ".next/**",
    "out/**",

    /*
    |--------------------------------------------------------------------------
    | BUILD OUTPUT
    |--------------------------------------------------------------------------
    */

    "build/**",
    "dist/**",
    "coverage/**",

    /*
    |--------------------------------------------------------------------------
    | FIREBASE
    |--------------------------------------------------------------------------
    */

    "functions/lib/**",
    ".firebase/**",
    "firebase-export/**",

    "firebase-debug.log",
    "firestore-debug.log",

    /*
    |--------------------------------------------------------------------------
    | TYPESCRIPT / NODE
    |--------------------------------------------------------------------------
    */

    "next-env.d.ts",
    "node_modules/**",

    /*
    |--------------------------------------------------------------------------
    | ENV / SECRETS
    |--------------------------------------------------------------------------
    */

    ".env",
    ".env.*",

    "**/serviceAccountKey.json",
    "**/*serviceAccount*.json",
    "**/*.serviceAccount.json",

    /*
    |--------------------------------------------------------------------------
    | TEMP FILES
    |--------------------------------------------------------------------------
    */

    "*.log",
    "*.tmp",
    "*.temp",

    /*
    |--------------------------------------------------------------------------
    | MAC / WINDOWS GARBAGE
    |--------------------------------------------------------------------------
    */

    ".DS_Store",
    "Thumbs.db",
  ]),
]);

export default eslintConfig;