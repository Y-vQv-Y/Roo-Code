import { existsSync, readFileSync, readdirSync } from "fs"
import { fileURLToPath } from "url"

describe("ADTEC Code package metadata", () => {
	const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"))

	it("uses the ADTEC Code brand without exposing a source repository", () => {
		expect(manifest.name).toBe("adtec-code")
		expect(manifest.displayName).toBe("ADTEC Code")
		expect(manifest.author).toEqual({ name: "ADTEC Code" })
		expect(manifest.repository).toBeUndefined()
	})

	it("uses the ADTEC Code display name in every VS Code locale", () => {
		const srcDir = fileURLToPath(new URL("..", import.meta.url))
		const localeFiles = readdirSync(srcDir).filter((file) => file.startsWith("package.nls") && file.endsWith(".json"))

		expect(localeFiles.length).toBeGreaterThan(0)
		for (const localeFile of localeFiles) {
			const locale = JSON.parse(readFileSync(new URL(`../${localeFile}`, import.meta.url), "utf-8"))
			expect(locale["extension.displayName"]).toBe("ADTEC Code")
		}
	})

	it("references the provided ADTEC logo", () => {
		expect(manifest.icon).toBe("assets/icons/adtec-logo.png")
		expect(manifest.contributes.viewsContainers.activitybar[0].icon).toBe("assets/icons/adtec-logo.png")
		expect(existsSync(fileURLToPath(new URL(`../${manifest.icon}`, import.meta.url)))).toBe(true)
	})

	it("packages a valid bundled test skill", () => {
		const vscodeIgnore = readFileSync(new URL("../.vscodeignore", import.meta.url), "utf-8")
		const skill = readFileSync(new URL("../builtin-skills/adtec-test/SKILL.md", import.meta.url), "utf-8")

		expect(vscodeIgnore).toContain("!builtin-skills/**")
		expect(skill).toContain("name: adtec-test")
		expect(skill).toContain("description:")
		expect(skill).toContain("ADTEC bundled skill loaded successfully.")
	})

	it("keeps the Marketplace README independent from a source repository", () => {
		const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf-8")
		const relativeLinks = Array.from(readme.matchAll(/\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g), (match) => match[1])

		expect(readme).toContain("# ADTEC Code")
		expect(readme).not.toContain("github.com")
		expect(relativeLinks).toEqual([])
	})
})
