import { EventEmitter } from "events"

import { compareVersions, getLatestCliVersion, runUpgradeInstaller, upgrade } from "../upgrade.js"

function createFetchResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
	const { ok = true, status = 200 } = init
	return {
		ok,
		status,
		json: async () => body,
	} as Response
}

describe("compareVersions", () => {
	it("returns 1 when first version is newer", () => {
		expect(compareVersions("0.2.0", "0.1.9")).toBe(1)
	})

	it("returns -1 when first version is older", () => {
		expect(compareVersions("0.1.4", "0.1.5")).toBe(-1)
	})

	it("returns 0 when versions are equivalent", () => {
		expect(compareVersions("v1.2.0", "1.2")).toBe(0)
	})

	it("supports cli tag prefixes and prerelease metadata", () => {
		expect(compareVersions("cli-v1.2.3", "1.2.2")).toBe(1)
		expect(compareVersions("1.2.3-beta.1", "1.2.3")).toBe(0)
	})

	it("compares multi-digit patch versions numerically", () => {
		expect(compareVersions("0.1.10", "0.1.9")).toBe(1)
	})
})

describe("getLatestCliVersion", () => {
	it("returns the highest cli-v release tag from GitHub releases", async () => {
		const fetchImpl = (async () =>
			createFetchResponse([
				{ tag_name: "cli-v0.1.9" },
				{ tag_name: "v9.9.9" },
				{ tag_name: "cli-v0.1.10" },
				{ tag_name: "cli-v0.1.8" },
			])) as typeof fetch

		await expect(getLatestCliVersion(fetchImpl, "https://releases.internal/adtec-code")).resolves.toBe("0.1.10")
	})

	it("accepts a main release tag when it contains CLI assets", async () => {
		const fetchImpl = (async () =>
			createFetchResponse([
				{ tag_name: "cli-v0.1.9" },
				{
					tag_name: "v0.1.10",
					assets: [{ name: "adtec-code-cli-windows-x64.zip" }],
				},
				{ tag_name: "v9.9.9", assets: [{ name: "adtec-code-9.9.9.vsix" }] },
			])) as typeof fetch

		await expect(getLatestCliVersion(fetchImpl, "https://releases.internal/adtec-code")).resolves.toBe("0.1.10")
	})

	it("throws when release check fails", async () => {
		const fetchImpl = (async () => createFetchResponse({}, { ok: false, status: 503 })) as typeof fetch

		await expect(getLatestCliVersion(fetchImpl, "https://releases.internal/adtec-code")).rejects.toThrow(
			"Failed to check latest version",
		)
	})
})

describe("runUpgradeInstaller", () => {
	function createSpawnMock() {
		return vi.fn(() => {
			const child = new EventEmitter()
			queueMicrotask(() => child.emit("close", 0, null))
			return child
		}) as unknown as typeof import("child_process").spawn
	}

	it("uses PowerShell for the Windows installer", async () => {
		const spawnImpl = createSpawnMock()

		await runUpgradeInstaller("0.2.0", spawnImpl, "win32", ".\\apps\\cli\\install.ps1")

		expect(spawnImpl).toHaveBeenCalledWith(
			"powershell.exe",
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ".\\apps\\cli\\install.ps1"],
			expect.objectContaining({
				env: expect.objectContaining({ ADTEC_CODE_VERSION: "0.2.0" }),
				stdio: "inherit",
			}),
		)
	})

	it("keeps the shell installer on Unix", async () => {
		const spawnImpl = createSpawnMock()

		await runUpgradeInstaller("0.2.0", spawnImpl, "linux", "./apps/cli/install.sh")

		expect(spawnImpl).toHaveBeenCalledWith(
			"sh",
			["-c", "./apps/cli/install.sh"],
			expect.objectContaining({ stdio: "inherit" }),
		)
	})
})

describe("upgrade", () => {
	let logSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	afterEach(() => {
		logSpy.mockRestore()
	})

	it("does not run installer when already up to date", async () => {
		const runInstaller = vi.fn(async () => undefined)
		const fetchImpl = (async () => createFetchResponse([{ tag_name: "cli-v0.1.4" }])) as typeof fetch

		await upgrade({
			currentVersion: "0.1.4",
			fetchImpl,
			runInstaller,
			releasesUrl: "https://releases.internal/adtec-code",
		})

		expect(runInstaller).not.toHaveBeenCalled()
		expect(logSpy).toHaveBeenCalledWith("ADTEC Code CLI is already up to date.")
	})

	it("runs installer when a newer version is available", async () => {
		const runInstaller = vi.fn(async () => undefined)
		const fetchImpl = (async () => createFetchResponse([{ tag_name: "cli-v0.2.0" }])) as typeof fetch

		await upgrade({
			currentVersion: "0.1.4",
			fetchImpl,
			runInstaller,
			releasesUrl: "https://releases.internal/adtec-code",
		})

		expect(runInstaller).toHaveBeenCalledTimes(1)
		expect(logSpy).toHaveBeenCalledWith("✓ Upgrade completed.")
	})
})
