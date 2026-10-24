import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Fonctions flottantes de Math, dont le résultat peut varier d'un navigateur à l'autre. */
const FLOAT_MATH = ["random", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sqrt", "cbrt", "pow", "exp", "expm1", "log", "log2", "log10", "log1p", "hypot", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "fround"];
const ENGINE_MESSAGE = "Moteur du battle royale : calculs entiers uniquement (src/lib/br/fixed.ts, rng.ts), sans horloge, pour un rejeu identique partout.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Moteur du battle royale : déterministe (rejeu par le serveur). Voir aussi src/lib/br/purity.test.ts.
  {
    files: ["src/lib/br/**/*.ts"],
    ignores: ["src/lib/br/**/*.test.ts"],
    rules: {
      "no-restricted-properties": ["error", ...FLOAT_MATH.map((property) => ({ object: "Math", property, message: ENGINE_MESSAGE }))],
      "no-restricted-globals": ["error", ...["Date", "performance", "crypto", "setTimeout", "setInterval"].map((name) => ({ name, message: ENGINE_MESSAGE }))],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
