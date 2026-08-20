import path from "path";
import { defineConfig } from "vitest/config";

// Deliberadamente separado de vite.config.ts: las pruebas cubren la lógica
// del motor, que es TypeScript puro, y no necesitan React ni Tailwind ni los
// plugins de runtime cargados para servir la web.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
