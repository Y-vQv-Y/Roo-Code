import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface GitStatus {
	branch: string
	clean: boolean
	files: string[]
}

export class GitService {
	async status(cwd: string): Promise<GitStatus> {
		const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "--branch"], { cwd, windowsHide: true })
		const lines = stdout.trimEnd().split(/\r?\n/).filter(Boolean)
		const branchLine = lines.find((line) => line.startsWith("## ")) ?? "## HEAD"
		const branch = branchLine.slice(3).split("...")[0] ?? "HEAD"
		return { branch, clean: lines.length <= 1, files: lines.filter((line) => !line.startsWith("## ")).map((line) => line.slice(3)) }
	}

	async diff(cwd: string, pathspec?: string): Promise<string> {
		const args = ["diff", "--no-ext-diff", "--"]
		if (pathspec) args.push(pathspec)
		const { stdout } = await execFileAsync("git", args, { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
		return stdout
	}

	async revertPath(cwd: string, pathspec: string): Promise<void> {
		await execFileAsync("git", ["restore", "--", pathspec], { cwd, windowsHide: true })
	}
}
