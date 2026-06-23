import { defineConfig, globalIgnores } from "eslint/config";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },

    linterOptions: {
      reportUnusedDisableDirectives: true,
    },

    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-return-await": "error",
      "no-unsafe-finally": "error",
      "no-debugger": "warn",
      "no-alert": "off",
      "prefer-const": "warn",
      "no-var": "error",

      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_"
        }
      ],

      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/consistent-type-exports": "off",
      "@typescript-eslint/consistent-type-imports": "off",

      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-ignore": "allow-with-description",
          minimumDescriptionLength: 6
        }
      ],

      "react/jsx-key": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/self-closing-comp": "warn",
      "react/no-unescaped-entities": "warn",

      "@next/next/no-img-element": "warn",

      "sort-imports": [
        "warn",
        {
          ignoreDeclarationSort: true,
          ignoreCase: true
        }
      ],

      curly: "off",
      "object-shorthand": ["warn", "always"],
      "prefer-template": "warn",

      "no-trailing-spaces": "warn",
      "eol-last": ["warn", "always"],
      "comma-dangle": "off"
    }
  },

  {
    files: ["functions/**/*.{ts,js}", "scripts/**/*.{ts,js,mjs,cjs}"],

    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off"
    }
  },

  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}"],

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off"
    }
  },

  globalIgnores([
    ".kilo/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "functions/lib/**",
    ".firebase/**",
    "firebase-export/**",
    "firebase-debug.log",
    "firestore-debug.log",
    "next-env.d.ts",
    "node_modules/**",
    ".env",
    ".env.*",
    "**/serviceAccountKey.json",
    "**/*serviceAccount*.json",
    "**/*.serviceAccount.json",
    "**/firebase-adminsdk*.json",
    "*.log",
    "*.tmp",
    "*.temp",
    ".DS_Store",
    "Thumbs.db"
  ])
]);

export default eslintConfig;
