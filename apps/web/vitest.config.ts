import { defineConfig } from "vitest/config"

export default defineConfig({
	test: { environment: "jsdom", globals: true, watch: false, include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
})
