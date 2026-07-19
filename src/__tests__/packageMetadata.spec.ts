import { existsSync, readFileSync, readdirSync } from "fs"
import { fileURLToPath } from "url"

import { getCodeActionCommand, getCommand, getTerminalCommand } from "../utils/commands"

describe("ADTEC Code package metadata", () => {
	const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"))

	it("uses the ADTEC Code brand and official source repository", () => {
		expect(manifest.name).toBe("adtec-code")
		expect(manifest.displayName).toBe("ADTEC Code")
		expect(manifest.author).toEqual({ name: "ADTEC Code" })
		expect(manifest.repository).toEqual({ type: "git", url: "https://github.com/Y-vQv-Y" })
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
		expect(manifest.contributes.viewsContainers.activitybar[0].icon).toBe(
			"assets/icons/adtec-activitybar.png",
		)
		expect(existsSync(fileURLToPath(new URL(`../${manifest.icon}`, import.meta.url)))).toBe(true)
		expect(
			existsSync(
				fileURLToPath(
					new URL(`../${manifest.contributes.viewsContainers.activitybar[0].icon}`, import.meta.url),
				),
			),
		).toBe(true)
	})

	it("uses the package name as the namespace for every VS Code contribution", () => {
		const namespace = manifest.name
		const activityBarId = `${namespace}-ActivityBar`
		const contributedCommands = new Set<string>(
			manifest.contributes.commands.map(({ command }: { command: string }) => command),
		)
		const extensionSource = readFileSync(new URL("../extension.ts", import.meta.url), "utf-8")

		expect(JSON.stringify(manifest.contributes)).toContain(namespace)
		expect(extensionSource).toContain("Package")
		expect(manifest.contributes.viewsContainers.activitybar[0].id).toBe(activityBarId)
		expect(Object.keys(manifest.contributes.views)).toContain(activityBarId)
		expect(manifest.contributes.views[activityBarId][0].id).toBe(`${namespace}.SidebarProvider`)
		expect(Object.keys(manifest.contributes.configuration.properties)).toEqual(
			expect.arrayContaining([
				`${namespace}.allowedCommands`,
				`${namespace}.customStoragePath`,
				`${namespace}.debug`,
			]),
		)
		expect(contributedCommands).toContain(getCommand("plusButtonClicked"))
		expect(contributedCommands).toContain(getCommand("historyButtonClicked"))
		expect(contributedCommands).toContain(getCommand("settingsButtonClicked"))
		expect(contributedCommands).toContain(getCodeActionCommand("explainCode"))
		expect(contributedCommands).toContain(getTerminalCommand("terminalAddToContext"))
	})

	it("packages a valid bundled test skill", () => {
		const vscodeIgnore = readFileSync(new URL("../.vscodeignore", import.meta.url), "utf-8")
		const skill = readFileSync(new URL("../builtin-skills/adtec-test/SKILL.md", import.meta.url), "utf-8")

		expect(vscodeIgnore).toContain("!builtin-skills/**")
		expect(skill).toContain("name: adtec-test")
		expect(skill).toContain("description:")
		expect(skill).toContain("ADTEC bundled skill loaded successfully.")
	})

	it("uses the official repository in the Marketplace README", () => {
		const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf-8")
		const relativeLinks = Array.from(readme.matchAll(/\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g), (match) => match[1])

		expect(readme).toContain("# ADTEC Code")
		expect(readme).toContain("https://github.com/Y-vQv-Y")
		expect(relativeLinks).toEqual([])
	})

	it("keeps the Marketplace changelog independent from a source repository", () => {
		const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf-8")
		const relativeLinks = Array.from(changelog.matchAll(/\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g), (match) => match[1])
		const relativeImages = Array.from(changelog.matchAll(/!\[[^\]]*\]\((?!https?:\/\/|data:)([^)]+)\)/g), (match) => match[1])

		expect(changelog).toContain("# ADTEC Code Changelog")
		expect(changelog).toContain("## 0.1.0")
		expect(changelog).not.toContain("github.com")
		expect(relativeLinks).toEqual([])
		expect(relativeImages).toEqual([])
	})

	it("publishes the branded VSIX and verifies the bundled test skill", () => {
		const workflow = readFileSync(new URL("../../.github/workflows/marketplace-publish.yml", import.meta.url), "utf-8")

		expect(workflow).toContain("package_name=$(node -p \"require('./src/package.json').name\")")
		expect(workflow).toContain('vsix_path="bin/${package_name}-${current_package_version}.vsix"')
		expect(workflow).toContain('unzip -l "$vsix_path"')
		expect(workflow).toContain("extension/builtin-skills/adtec-test/SKILL.md")
		expect(workflow).toMatch(/gh release create[\s\S]*"\$vsix_path"/)
		expect(workflow).not.toContain("bin/adtec-code-${current_package_version}.vsix")
	})

	it("packages the branded CLI with bundled skills", () => {
		const cliPackage = JSON.parse(
			readFileSync(new URL("../../apps/cli/package.json", import.meta.url), "utf-8"),
		)
		const workflow = readFileSync(
			new URL("../../.github/workflows/cli-release.yml", import.meta.url),
			"utf-8",
		)

		expect(cliPackage.name).toBe("@adtec-code/cli")
		expect(workflow).toContain("pnpm --filter @adtec-code/cli build")
		expect(workflow).toContain('cp -r src/builtin-skills/* "$RELEASE_DIR/extension/builtin-skills/"')
		expect(workflow).toContain("extension/builtin-skills/adtec-test/SKILL.md")
	})

	it("extracts release notes from the unbracketed ADTEC changelog heading", () => {
		const workflow = readFileSync(new URL("../../.github/workflows/marketplace-publish.yml", import.meta.url), "utf-8")

		expect(workflow).toContain('$0 == "## " version')
		expect(workflow).toContain("capture && /^## / { exit }")
	})
})
