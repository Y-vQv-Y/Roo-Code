import { spawn } from "child_process"

import { VERSION } from "@/lib/utils/version.js"
import { isRecord } from "@/lib/utils/guards.js"

export const INSTALL_SCRIPT_COMMAND = process.env.ADTEC_CODE_INSTALL_COMMAND

export interface UpgradeOptions {
	currentVersion?: string
	fetchImpl?: typeof fetch
	runInstaller?: () => Promise<void>
	releasesUrl?: string
}

function parseVersion(version: string): number[] {
	const cleaned = version
		.trim()
		.replace(/^cli-v/, "")
		.replace(/^v/, "")
	const core = cleaned.split("+", 1)[0]?.split("-", 1)[0]

	if (!core) {
		throw new Error(`Invalid version: ${version}`)
	}

	const parts = core.split(".")
	if (parts.length === 0) {
		throw new Error(`Invalid version: ${version}`)
	}

	return parts.map((part) => {
		if (!/^\d+$/.test(part)) {
			throw new Error(`Invalid version: ${version}`)
		}

		return Number.parseInt(part, 10)
	})
}

/**
 * Returns:
 * - 1 when `a > b`
 * - 0 when `a === b`
 * - -1 when `a < b`
 */
export function compareVersions(a: string, b: string): number {
	const aParts = parseVersion(a)
	const bParts = parseVersion(b)
	const maxLength = Math.max(aParts.length, bParts.length)

	for (let i = 0; i < maxLength; i++) {
		const aPart = aParts[i] ?? 0
		const bPart = bParts[i] ?? 0

		if (aPart > bPart) {
			return 1
		}

		if (aPart < bPart) {
			return -1
		}
	}

	return 0
}

export async function getLatestCliVersion(
	fetchImpl: typeof fetch = fetch,
	releasesUrl = process.env.ADTEC_CODE_RELEASES_URL,
): Promise<string> {
	if (!releasesUrl) {
		throw new Error("CLI upgrades are managed by the internal ADTEC Code distribution service.")
	}

	const response = await fetchImpl(releasesUrl, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "adtec-code-cli",
		},
	})

	if (!response.ok) {
		throw new Error(`Failed to check latest version (HTTP ${response.status})`)
	}

	const releases = await response.json()
	if (!Array.isArray(releases)) {
		throw new Error("Invalid release response from GitHub.")
	}

	let latestVersion: string | undefined

	for (const release of releases) {
		if (!isRecord(release)) {
			continue
		}

		const tagName = release.tag_name
		if (typeof tagName === "string" && tagName.startsWith("cli-v")) {
			const candidate = tagName.slice("cli-v".length)
			try {
				if (!latestVersion || compareVersions(candidate, latestVersion) > 0) {
					latestVersion = candidate
				}
			} catch {
				// Ignore malformed CLI tags and keep scanning other releases.
			}
		}
	}

	if (latestVersion) {
		return latestVersion
	}

	throw new Error("Could not determine the latest CLI release version.")
}

export function runUpgradeInstaller(version?: string, spawnImpl: typeof spawn = spawn): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!INSTALL_SCRIPT_COMMAND) {
			reject(new Error("No internal ADTEC Code install command is configured."))
			return
		}

		const env = version ? { ...process.env, ADTEC_CODE_VERSION: version } : process.env
		const child = spawnImpl("sh", ["-c", INSTALL_SCRIPT_COMMAND], { stdio: "inherit", env })

		child.once("error", (error) => {
			reject(error)
		})

		child.once("close", (code, signal) => {
			if (code === 0) {
				resolve()
				return
			}

			const reason = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`
			reject(new Error(`Upgrade installer failed (${reason}).`))
		})
	})
}

export async function upgrade(options: UpgradeOptions = {}): Promise<void> {
	const currentVersion = options.currentVersion ?? VERSION
	const fetchImpl = options.fetchImpl ?? fetch
	const runInstaller = options.runInstaller

	console.log(`Current version: ${currentVersion}`)

	const latestVersion = await getLatestCliVersion(fetchImpl, options.releasesUrl)
	console.log(`Latest version: ${latestVersion}`)

	if (compareVersions(latestVersion, currentVersion) <= 0) {
		console.log("ADTEC Code CLI is already up to date.")
		return
	}

	console.log(`Upgrading ADTEC Code CLI from ${currentVersion} to ${latestVersion}...`)
	if (runInstaller) {
		await runInstaller()
	} else {
		await runUpgradeInstaller(latestVersion)
	}
	console.log("✓ Upgrade completed.")
}
