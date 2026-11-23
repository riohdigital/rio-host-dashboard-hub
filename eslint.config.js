import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Cores só pelos tokens de src/styles/tokens.css (classes brand, success,
    // danger… ou hsl(var(--token))). Hex novo em .tsx é erro.
    files: ["src/**/*.tsx"],
    // Modelos capturados para PDF/recibo: o html2canvas precisa de cor literal.
    ignores: ["src/components/reports/**", "src/components/ui/chart.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/]",
          message: "Cor em hex: use um token de src/styles/tokens.css (ex.: bg-brand, text-success, hsl(var(--danger))).",
        },
        {
          selector: "TemplateElement[value.raw=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/]",
          message: "Cor em hex: use um token de src/styles/tokens.css (ex.: bg-brand, text-success, hsl(var(--danger))).",
        },
      ],
    },
  }
);
