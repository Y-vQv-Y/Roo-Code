import fs from "node:fs"

export function normalizeVersion(value) {
	const match = String(value ?? "")
		.trim()
		.match(/^(?:cli-)?v?(\d+(?:\.\d+){0,3})(?:[-+].*)?$/)

	return match?.[1] ?? null
}

export function compareVersions(a, b) {
	const aParts = normalizeVersion(a)?.split(".").map(Number)
	const bParts = normalizeVersion(b)?.split(".").map(Number)

	if (!aParts || !bParts) {
		return 0
	}

	const length = Math.max(aParts.length, bParts.length)
	for (let index = 0; index < length; index += 1) {
		const aPart = aParts[index] ?? 0
		const bPart = bParts[index] ?? 0
		if (aPart !== bPart) {
			return aPart > bPart ? 1 : -1
		}
	}

	return 0
}

export function resolveReleaseAsset(releases, { assetName, requestedVersion } = {}) {
	if (!Array.isArray(releases) || !assetName) {
		return null
	}

	const requested = requestedVersion ? normalizeVersion(requestedVersion) : null
	if (requestedVersion && !requested) {
		return null
	}
	const candidates = releases
		.filter((release) => {
			if (!release || release.draft === true || typeof release.tag_name !== "string") {
				return false
			}

			const version = normalizeVersion(release.tag_name)
			return (
				version &&
				(!requested || version === requested) &&
				Array.isArray(release.assets) &&
				release.assets.some((asset) => asset?.name === assetName && typeof asset.browser_download_url === "string")
			)
		})
		.map((release) => {
			const asset = release.assets.find((candidate) => candidate?.name === assetName)
			return {
				tag: release.tag_name,
				version: normalizeVersion(release.tag_name),
				url: asset.browser_download_url,
			}
		})
		.sort((a, b) => compareVersions(b.version, a.version))

	return candidates[0] ?? null
}

if (process.argv[1]?.endsWith("resolve-release.mjs")) {
	const args = process.argv.slice(2)
	const assetIndex = args.indexOf("--asset")
	const versionIndex = args.indexOf("--version")
	const assetName = assetIndex >= 0 ? args[assetIndex + 1] : undefined
	const requestedVersion = versionIndex >= 0 ? args[versionIndex + 1] : undefined
	const releases = JSON.parse(fs.readFileSync(0, "utf8"))
	const result = resolveReleaseAsset(releases, { assetName, requestedVersion })

	if (result) {
		process.stdout.write(JSON.stringify(result))
	}
}
