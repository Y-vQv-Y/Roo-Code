import path from "node:path"

export class WorkspacePathError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "WorkspacePathError"
	}
}

export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
	if (!relativePath || path.isAbsolute(relativePath)) {
		throw new WorkspacePathError("A relative workspace path is required")
	}

	const root = path.resolve(workspaceRoot)
	const resolved = path.resolve(root, relativePath)
	const relative = path.relative(root, resolved)
	if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new WorkspacePathError("Path escapes the workspace root")
	}

	return resolved
}

export function normalizeWorkspacePath(relativePath: string): string {
	const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"))
	if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized.startsWith("/")) {
		throw new WorkspacePathError("Path must stay inside the workspace")
	}
	return normalized
}
