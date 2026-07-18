import path from "path"
import { RooProtectedController } from "../RooProtectedController"

describe("RooProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: RooProtectedController

	beforeEach(() => {
		controller = new RooProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .adtecignore file", () => {
			expect(controller.isWriteProtected(".adtecignore")).toBe(true)
		})

		it("should protect files in .adtec directory", () => {
			expect(controller.isWriteProtected(".adtec/config.json")).toBe(true)
			expect(controller.isWriteProtected(".adtec/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".adtec/modes/custom.json")).toBe(true)
		})

		it("should protect .adtecprotected file", () => {
			expect(controller.isWriteProtected(".adtecprotected")).toBe(true)
		})

		it("should protect .adtecmodes files", () => {
			expect(controller.isWriteProtected(".adtecmodes")).toBe(true)
		})

		it("should protect .adtecrules* files", () => {
			expect(controller.isWriteProtected(".adtecrules")).toBe(true)
			expect(controller.isWriteProtected(".adtecrules.md")).toBe(true)
		})

		it("should protect .clinerules* files", () => {
			expect(controller.isWriteProtected(".clinerules")).toBe(true)
			expect(controller.isWriteProtected(".clinerules.md")).toBe(true)
		})

		it("should protect files in .vscode directory", () => {
			expect(controller.isWriteProtected(".vscode/settings.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/launch.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/tasks.json")).toBe(true)
		})

		it("should protect .code-workspace files", () => {
			expect(controller.isWriteProtected("myproject.code-workspace")).toBe(true)
			expect(controller.isWriteProtected("pentest.code-workspace")).toBe(true)
			expect(controller.isWriteProtected(".code-workspace")).toBe(true)
			expect(controller.isWriteProtected("folder/workspace.code-workspace")).toBe(true)
		})

		it("should protect AGENTS.md file", () => {
			expect(controller.isWriteProtected("AGENTS.md")).toBe(true)
		})

		it("should protect AGENT.md file", () => {
			expect(controller.isWriteProtected("AGENT.md")).toBe(true)
		})

		it("should not protect other files starting with .adtec", () => {
			expect(controller.isWriteProtected(".roosettings")).toBe(false)
			expect(controller.isWriteProtected(".rooconfig")).toBe(false)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain 'roo' but don't start with .adtec", () => {
			expect(controller.isWriteProtected("src/roo-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/roo.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected(".adtec/config.json")).toBe(true) // .adtec/** matches at root
			expect(controller.isWriteProtected("nested/.adtecignore")).toBe(true) // .adtecignore matches anywhere by default
			expect(controller.isWriteProtected("nested/.adtecmodes")).toBe(true) // .adtecmodes matches anywhere by default
			expect(controller.isWriteProtected("nested/.adtecrules.md")).toBe(true) // .adtecrules* matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".adtecignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".adtec\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".adtec/config.json")).toBe(true)
		})

		it("should not throw for absolute paths outside cwd", () => {
			expect(controller.isWriteProtected("/tmp/comment-2-pr63.json")).toBe(false)
			expect(controller.isWriteProtected("/etc/passwd")).toBe(false)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".adtecignore", "package.json", ".adtec/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".adtecignore", ".adtec/config.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".adtecignore", ".adtec/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".adtecignore", isProtected: true },
				{ path: ".adtec/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a ADTEC Code configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".adtecignore")
			expect(instructions).toContain(".adtec/**")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = RooProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([
				".adtecignore",
				".adtecmodes",
				".adtecrules*",
				".clinerules*",
				".adtec/**",
				".vscode/**",
				"*.code-workspace",
				".adtecprotected",
				"AGENTS.md",
				"AGENT.md",
			])
		})
	})
})
