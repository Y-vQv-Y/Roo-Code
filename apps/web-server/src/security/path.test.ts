import { describe, expect, it } from "vitest"
import path from "node:path"
import { normalizeWorkspacePath, resolveWorkspacePath, WorkspacePathError } from "./path.js"

describe("workspace path policy", () => {
	it("normalizes safe relative paths", () => {
		expect(normalizeWorkspacePath("src\\index.ts")).toBe("src/index.ts")
		const root = path.join(path.parse(process.cwd()).root, "workspace", "project")
		expect(resolveWorkspacePath(root, "src/index.ts")).toBe(path.join(root, "src", "index.ts"))
	})

	it("rejects absolute and traversal paths", () => {
		expect(() => normalizeWorkspacePath("../secret.txt")).toThrow(WorkspacePathError)
		expect(() => resolveWorkspacePath("/workspace/project", "/etc/passwd")).toThrow(WorkspacePathError)
	})
})
