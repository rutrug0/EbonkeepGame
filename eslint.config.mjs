import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";
import tseslint from "typescript-eslint";

const typescriptFiles = ["**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.vite/**",
      "**/coverage/**",
      "**/tsconfig.tsbuildinfo"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: typescriptFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      boundaries
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "packages/shared/src/**/*.ts"],
    settings: {
      "boundaries/include": [
        "apps/web/src/**/*",
        "packages/shared/src/**/*"
      ],
      "boundaries/elements": [
        { type: "web-app", pattern: "apps/web/src/app/*" },
        { type: "web-feature", pattern: "apps/web/src/features/*/**/*" },
        { type: "web-shared", pattern: "apps/web/src/lib/**/*" },
        { type: "web-shared", pattern: "apps/web/src/constants/**/*" },
        { type: "web-shared", pattern: "apps/web/src/generated/**/*" },
        { type: "web-shared", pattern: "apps/web/src/i18n/**/*" },
        { type: "shared-core", pattern: "packages/shared/src/core/**/*" },
        { type: "shared-domain", pattern: "packages/shared/src/domains/*/**/*" }
      ]
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: "web-app",
              allow: ["web-feature", "web-shared", "shared-core", "shared-domain"]
            },
            {
              from: "web-feature",
              allow: ["web-feature", "web-shared", "shared-core", "shared-domain"]
            },
            {
              from: "shared-core",
              allow: ["shared-core"]
            },
            {
              from: "shared-domain",
              allow: ["shared-core", "shared-domain"]
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@ebonkeep/shared",
              message: "Use @ebonkeep/shared/<domain> subpaths from app-layer files."
            }
          ],
          patterns: [
            {
              group: ["../features/*/*", "../features/*/*/*"],
              message: "Import feature public entrypoints only from app-layer files."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}", "apps/web/src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@ebonkeep/shared",
              message: "Use @ebonkeep/shared/<domain> subpaths from refactored web surfaces."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/shared/src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../domains/**"],
              message: "Core shared modules cannot depend on domain modules."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/shared/src/domains/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../index.js"],
              message: "Import shared contracts from core or domain entrypoints, not the compatibility barrel."
            }
          ]
        }
      ]
    }
  }
);
