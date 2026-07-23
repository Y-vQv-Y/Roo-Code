import { randomUUID } from "node:crypto"
import { readFile, readdir, realpath, unlink, writeFile, mkdir, rename } from "node:fs/promises"
import path from "node:path"
import ignore from "ignore"
import type { FileChange } from "../domain.js"
import { normalizeWorkspacePath, resolveWorkspacePath } from "../security/path.js"
import { lineDiff } from "./diff.js"
import { applyPatchToFiles, parsePatch } from "./patch.js"

export class WorkspaceFileService {
	private readonly root: string
	private readonly ignored = ignore()

	constructor(root: string, ignoredPatterns: readonly string[] = []) {
		this.root = path.resolve(root)
		this.ignored.add(ignoredPatterns.filter((pattern) => pattern.trim() !== ""))
	}

	private relative(filePath: string): string {
		return path.relative(this.root, filePath).replaceAll("\\", "/")
	}

	private async assertInside(filePath: string, allowMissing: boolean): Promise<void> {
		const root = await realpath(this.root)
		let candidate = filePath
		if (allowMissing) {
			while (true) {
				try {
					candidate = await realpath(candidate)
					break
				} catch {
					const parent = path.dirname(candidate)
					if (parent === candidate) throw new Error("Unable to resolve workspace path")
					candidate = parent
				}
			}
		} else {
			candidate = await realpath(candidate)
		}
		const relative = path.relative(root, candidate)
		if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Path escapes the workspace root")
	}

	private getPath(relativePath: string): { relative: string; absolute: string } {
		const relative = normalizeWorkspacePath(relativePath)
		return { relative, absolute: resolveWorkspacePath(this.root, relative) }
	}

	async read(relativePath: string): Promise<string> {
		const target = this.getPath(relativePath)
		await this.assertInside(target.absolute, false)
		if (this.ignored.ignores(target.relative)) throw new Error("File is ignored by workspace policy")
		return readFile(target.absolute, "utf8")
	}

	async list(relativePath = ""): Promise<string[]> {
		const relative = relativePath === "" ? "" : normalizeWorkspacePath(relativePath)
		const absolute = relative === "" ? this.root : resolveWorkspacePath(this.root, relative)
		await this.assertInside(absolute, false)
		const entries = await readdir(absolute, { withFileTypes: true })
		return entries
			.filter((entry) => !this.ignored.ignores(path.posix.join(relative, entry.name)))
			.map((entry) => path.posix.join(relative, entry.name))
			.sort()
	}

	async write(relativePath: string, content: string): Promise<FileChange> {
		const target = this.getPath(relativePath)
		if (this.ignored.ignores(target.relative)) throw new Error("File is ignored by workspace policy")
		await mkdir(path.dirname(target.absolute), { recursive: true })
		await this.assertInside(target.absolute, true)
		let before = ""
		try {
			before = await readFile(target.absolute, "utf8")
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
		}
		const temp = `${target.absolute}.${randomUUID()}.tmp`
		await writeFile(temp, content, "utf8")
		await rename(temp, target.absolute)
		return { path: target.relative, operation: "write", diff: lineDiff(before, content) }
	}

	async delete(relativePath: string): Promise<FileChange> {
		const target = this.getPath(relativePath)
		await this.assertInside(target.absolute, false)
		const before = await readFile(target.absolute, "utf8")
		await unlink(target.absolute)
		return { path: target.relative, operation: "delete", diff: lineDiff(before, "") }
	}

	async applyPatch(patch: string): Promise<FileChange[]> {
		const operations = parsePatch(patch)
		const paths = operations.flatMap((operation) => [operation.path, ...(operation.moveTo ? [operation.moveTo] : [])])
		const uniquePaths = [...new Set(paths)]
		const files: Record<string, string | undefined> = {}
		for (const filePath of uniquePaths) {
			try {
				files[filePath] = await this.read(filePath)
			} catch (error) {
				if (String((error as Error).message).includes("ENOENT")) files[filePath] = undefined
				else throw error
			}
		}
		const result = applyPatchToFiles(patch, files)
		for (const filePath of uniquePaths) {
			if (result.contents[filePath] === undefined && files[filePath] !== undefined) await this.delete(filePath)
			else if (result.contents[filePath] !== undefined) await this.write(filePath, result.contents[filePath])
		}
		return result.changes
	}
}
