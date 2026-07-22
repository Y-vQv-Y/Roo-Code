import { compareVersions, normalizeVersion, resolveReleaseAsset } from "./resolve-release.mjs"

describe("resolve-release", () => {
	it("normalizes supported release tag formats", () => {
		expect(normalizeVersion("v0.1.10")).toBe("0.1.10")
		expect(normalizeVersion("cli-v0.1.9")).toBe("0.1.9")
		expect(normalizeVersion("release-0.1.9")).toBeNull()
	})

	it("compares versions numerically", () => {
		expect(compareVersions("0.1.10", "0.1.9")).toBe(1)
		expect(compareVersions("0.1.9", "0.1.10")).toBe(-1)
	})

	it("selects the newest release containing the requested platform asset", () => {
		const releases = [
			{
				tag_name: "v0.1.9",
				assets: [{ name: "adtec-code-cli-windows-x64.zip", browser_download_url: "https://example.test/9.zip" }],
			},
			{
				tag_name: "v0.1.10",
				assets: [{ name: "adtec-code-cli-windows-x64.zip", browser_download_url: "https://example.test/10.zip" }],
			},
			{
				tag_name: "v0.1.11",
				assets: [{ name: "adtec-code-0.1.11.vsix", browser_download_url: "https://example.test/vsix" }],
			},
		]

		expect(resolveReleaseAsset(releases, { assetName: "adtec-code-cli-windows-x64.zip" })).toEqual({
			tag: "v0.1.10",
			version: "0.1.10",
			url: "https://example.test/10.zip",
		})
	})

	it("honors an explicitly requested version", () => {
		const releases = [
			{
				tag_name: "v0.1.9",
				assets: [{ name: "adtec-code-cli-macos-arm64.tar.gz", browser_download_url: "https://example.test/9.tgz" }],
			},
			{
				tag_name: "cli-v0.1.10",
				assets: [{ name: "adtec-code-cli-macos-arm64.tar.gz", browser_download_url: "https://example.test/10.tgz" }],
			},
		]

		expect(
			resolveReleaseAsset(releases, {
				assetName: "adtec-code-cli-macos-arm64.tar.gz",
				requestedVersion: "0.1.9",
			}),
		).toMatchObject({ tag: "v0.1.9", version: "0.1.9" })
	})

	it("rejects an invalid requested version instead of falling back to latest", () => {
		expect(
			resolveReleaseAsset(
				[
					{
						tag_name: "v0.1.0",
						assets: [
							{
								name: "adtec-code-cli-windows-x64.zip",
								browser_download_url: "https://example.test/0.zip",
							},
						],
					},
				],
				{ assetName: "adtec-code-cli-windows-x64.zip", requestedVersion: "latest" },
			),
		).toBeNull()
	})
})
