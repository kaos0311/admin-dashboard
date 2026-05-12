import { defineConfig, globalIgnores } from "eslint/config";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      /*
      |--------------------------------------------------------------------------
      | GENERAL SAFETY
      |--------------------------------------------------------------------------
      */

      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      eqeqeq: ["error", "always"],

      "no-duplicate-imports": "error",

      "no-unreachable": "error",

      "no-return-await": "error",

      /*
      |--------------------------------------------------------------------------
      | TYPESCRIPT
      |--------------------------------------------------------------------------
      */

      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],

      "@typescript-eslint/require-await": "warn",

      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "@typescript-eslint/consistent-type-exports": "warn",

      "@typescript-eslint/no-floating-promises": "error",

      "@typescript-eslint/no-unnecessary-type-assertion":
        "warn",

      /*
      |--------------------------------------------------------------------------
      | REACT / NEXT
      |--------------------------------------------------------------------------
      */

      "react/jsx-key": "error",

      "react-hooks/exhaustive-deps": "warn",

      "react/self-closing-comp": "warn",

      "@next/next/no-img-element": "warn",

      /*
      |--------------------------------------------------------------------------
      | IMPORT HYGIENE
      |--------------------------------------------------------------------------
      */

      "sort-imports": [
        "warn",
        {
          ignoreDeclarationSort: true,
        },
      ],
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
    | NEXT / BUILD
    |--------------------------------------------------------------------------
    */

    ".next/**",
    "out/**",
    "build/**",
    "dist/**",

    /*
    |--------------------------------------------------------------------------
    | GENERATED FILES
    |--------------------------------------------------------------------------
    */

    "next-env.d.ts",

    /*
    |--------------------------------------------------------------------------
    | DEPENDENCIES
    |--------------------------------------------------------------------------
    */

    "node_modules/**",

    /*
    |--------------------------------------------------------------------------
    | LOG FILES
    |--------------------------------------------------------------------------
    */

    "*.log",
    "firebase-debug.log",
    "firestore-debug.log",

    /*
    |--------------------------------------------------------------------------
    | FIREBASE
    |--------------------------------------------------------------------------
    */

    ".firebase/**",

    /*
    |--------------------------------------------------------------------------
    | SECURITY
    |--------------------------------------------------------------------------
    |
    | Prevent accidental credential commits.
    |
    */

    "**/serviceAccountKey.json",
    "**/*serviceAccount*.json",
    "**/*.serviceAccount.json",

    /*
    |--------------------------------------------------------------------------
    | OPTIONAL ENV FILES
    |--------------------------------------------------------------------------
    */

    ".env",
    ".env.*",
  ]),
]);

export default eslintConfig;