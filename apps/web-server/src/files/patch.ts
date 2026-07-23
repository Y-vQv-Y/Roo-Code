import type { FileChange, FileOperation } from "../domain.js"
import { normalizeWorkspacePath } from "../security/path.js"
import { lineDiff } from "./diff.js"

export interface PatchOperation {
	path: string
	operation: FileOperation
	content?: string
	moveTo?: string
}

export class PatchFormatError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "PatchFormatError"
	}
}

export function parsePatch(patch: string): PatchOperation[] {
	const lines = patch.replaceAll("\r\n", "\n").split("\n")
	if (lines[0] !== "*** Begin Patch" || lines.at(-1) !== "*** End Patch") {
		throw new PatchFormatError("Patch must start with *** Begin Patch and end with *** End Patch")
	}

	const operations: PatchOperation[] = []
	let index = 1
	while (index < lines.length - 1) {
		const header = lines[index]
		if (header.startsWith("*** Add File: ")) {
			const path = normalizeWorkspacePath(header.slice("*** Add File: ".length))
			const content: string[] = []
			index += 1
			while (index < lines.length - 1 && !lines[index].startsWith("*** ")) {
				const line = lines[index]
				if (!line.startsWith("+")) throw new PatchFormatError(`Added file line must start with +: ${line}`)
				content.push(line.slice(1))
				index += 1
			}
			operations.push({ path, operation: "write", content: content.join("\n") })
			continue
		}
		if (header.startsWith("*** Delete File: ")) {
			operations.push({ path: normalizeWorkspacePath(header.slice("*** Delete File: ".length)), operation: "delete" })
			index += 1
			continue
		}
		if (header.startsWith("*** Update File: ")) {
			const path = normalizeWorkspacePath(header.slice("*** Update File: ".length))
			index += 1
			let moveTo: string | undefined
			if (lines[index]?.startsWith("*** Move to: ")) {
				moveTo = normalizeWorkspacePath(lines[index].slice("*** Move to: ".length))
				index += 1
			}
			const hunks: string[] = []
			while (index < lines.length - 1 && !lines[index].startsWith("*** ")) {
				hunks.push(lines[index])
				index += 1
			}
			operations.push({ path, operation: "patch", content: hunks.join("\n"), moveTo })
			continue
		}
		if (header.trim() !== "") throw new PatchFormatError(`Unknown patch directive: ${header}`)
		index += 1
	}
	return operations
}

function applyHunks(before: string, hunkText: string): string {
	const source = before === "" ? [] : before.split("\n")
	const lines = hunkText === "" ? [] : hunkText.split("\n")
	const result = [...source]
	let cursor = 0
	let offset = 0
	for (const line of lines) {
		if (line.startsWith("@@")) continue
		if (!line.startsWith(" ") && !line.startsWith("+") && !line.startsWith("-")) {
			throw new PatchFormatError(`Invalid hunk line: ${line}`)
		}
		if (line.startsWith(" ")) {
			const expected = line.slice(1)
			const actual = result[cursor + offset]
			if (actual !== expected) throw new PatchFormatError(`Patch context did not match: ${expected}`)
			cursor += 1
		} else if (line.startsWith("-")) {
			const expected = line.slice(1)
			const actual = result[cursor + offset]
			if (actual !== expected) throw new PatchFormatError(`Patch removal did not match: ${expected}`)
			result.splice(cursor + offset, 1)
			offset -= 1
			cursor += 1
		} else {
			result.splice(cursor + offset, 0, line.slice(1))
			offset += 1
		}
	}
	return result.join("\n")
}

export function applyPatchToFiles(
	patch: string,
	files: Readonly<Record<string, string | undefined>>,
): { contents: Record<string, string | undefined>; changes: FileChange[] } {
	const contents = { ...files }
	const changes: FileChange[] = []
	for (const operation of parsePatch(patch)) {
		const before = contents[operation.path]
		if (operation.operation === "delete") {
			if (before === undefined) throw new PatchFormatError(`Cannot delete missing file: ${operation.path}`)
			delete contents[operation.path]
			changes.push({ path: operation.path, operation: "delete", diff: lineDiff(before, "") })
			continue
		}
		if (operation.operation === "write") {
			if (before !== undefined) throw new PatchFormatError(`Cannot add an existing file: ${operation.path}`)
			contents[operation.path] = operation.content ?? ""
			changes.push({ path: operation.path, operation: "write", diff: lineDiff("", operation.content ?? "") })
			continue
		}
		if (before === undefined) throw new PatchFormatError(`Cannot update missing file: ${operation.path}`)
		const after = applyHunks(before, operation.content ?? "")
		if (operation.moveTo) {
			if (contents[operation.moveTo] !== undefined) throw new PatchFormatError(`Cannot move over existing file: ${operation.moveTo}`)
			delete contents[operation.path]
			contents[operation.moveTo] = after
			changes.push({ path: operation.path, operation: "delete", diff: lineDiff(before, "") })
			changes.push({ path: operation.moveTo, operation: "write", diff: lineDiff("", after) })
		} else {
			contents[operation.path] = after
			changes.push({ path: operation.path, operation: "patch", diff: lineDiff(before, after) })
		}
	}
	return { contents, changes }
}
