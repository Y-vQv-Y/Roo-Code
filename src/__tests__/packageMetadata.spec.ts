import { existsSync, readFileSync, readdirSync } from "fs"
import { fileURLToPath } from "url"
import { parse } from "yaml"

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

		expect(parse(workflow)).toBeDefined()
		expect(workflow).toContain("package_name=$(node -p \"require('./src/package.json').name\")")
		expect(workflow).toContain('vsix_path="bin/${package_name}-${current_package_version}.vsix"')
		expect(workflow).toContain('unzip -l "$vsix_path"')
		expect(workflow).toContain("extension/builtin-skills/adtec-test/SKILL.md")
		expect(workflow).toContain('sha256sum "$(basename "$vsix_path")" > "$(basename "$vsix_path").sha256"')
		expect(workflow).toMatch(/gh release create "\$RELEASE_TAG"[\s\S]*release\/\*/)
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
		const windowsPackager = readFileSync(
			new URL("../../apps/cli/scripts/package-windows.ps1", import.meta.url),
			"utf-8",
		)
		const windowsInstaller = readFileSync(new URL("../../apps/cli/install.ps1", import.meta.url), "utf-8")

		expect(cliPackage.name).toBe("@adtec-code/cli")
		expect(cliPackage.version).toBe(manifest.version)
		expect(parse(workflow)).toBeDefined()
		expect(workflow).toContain("workflow_call:")
		expect(workflow).toContain("pnpm --filter @adtec-code/cli build")
		expect(workflow).toContain('cp -r src/builtin-skills/* "$RELEASE_DIR/extension/builtin-skills/"')
		expect(workflow).toContain("extension/builtin-skills/adtec-test/SKILL.md")
		expect(workflow).toContain("platform: macos-arm64")
		expect(workflow).toContain("platform: macos-x64")
		expect(workflow).toContain("platform: windows-x64")
		expect(workflow).toContain("platform: linux-x64")
		expect(workflow).toContain("platform: linux-arm64")
		expect(workflow).not.toContain("platform: darwin-")
		expect(workflow).toMatch(
			/- name: Setup Node\.js and pnpm\s+uses: \.\/\.github\/actions\/setup-node-pnpm\s+env:\s+GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/,
		)
		expect(workflow).toContain("./apps/cli/scripts/package-windows.ps1")
		expect(workflow).toContain("Windows CLI --help check failed")
		expect(workflow).not.toContain("workflow_run:")
		expect(workflow).not.toContain("cli-v$VERSION")
		expect(workflow).not.toContain("gh release create")
		expect(windowsPackager).toContain('set "ADTEC_CODE_RIPGREP_PATH=%~dp0rg.exe"')
		expect(windowsPackager).toContain("Compress-Archive")
		expect(windowsInstaller).toContain("Installed CLI failed the --version check")
		expect(windowsInstaller).toContain("SetEnvironmentVariable")
	})

	it("extracts release notes from the unbracketed ADTEC changelog heading", () => {
		const workflow = readFileSync(new URL("../../.github/workflows/marketplace-publish.yml", import.meta.url), "utf-8")

		expect(workflow).toContain('$0 == "## " version')
		expect(workflow).toContain("capture && /^## / { exit }")
	})

	it("publishes the VSIX and every CLI platform through one guarded product release", () => {
		const workflow = readFileSync(new URL("../../.github/workflows/marketplace-publish.yml", import.meta.url), "utf-8")

		expect(workflow).toContain("uses: ./.github/workflows/cli-release.yml")
		expect(workflow).toContain("needs: [resolve-release, build-vsix, build-cli]")
		expect(workflow).toContain("expected_files=12")
		expect(workflow).toContain('RELEASE_TAG="v$VERSION"')
		expect(workflow).toContain('Tag $RELEASE_TAG already points at $TAGGED_COMMIT, not $CURRENT_COMMIT')
		expect(workflow).toContain('gh release upload "$RELEASE_TAG" release/* --clobber')
		expect(workflow).toContain("needs.resolve-release.outputs.should_release == 'false'")
		expect(workflow).not.toContain("gh release delete")
		expect(workflow).not.toContain('git push origin ":refs/tags/')
		expect(workflow).not.toContain("git push --force")
	})
})
