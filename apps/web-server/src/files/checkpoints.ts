import { randomUUID } from "node:crypto"
import { readdir } from "node:fs/promises"
import path from "node:path"
import type { Checkpoint, FileChange, Workspace } from "../domain.js"
import type { CheckpointStore } from "../store/contracts.js"
import { WorkspaceFileService } from "./workspace-files.js"

async function collectFiles(root: string, current = ""): Promise<string[]> {
	const directory = path.join(root, current)
	const entries = await readdir(directory, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		if (entry.isDirectory() && (entry.name === ".git" || entry.name === ".adtec")) continue
		const relative = path.posix.join(current.replaceAll("\\", "/"), entry.name)
		if (entry.isDirectory()) files.push(...(await collectFiles(root, relative)))
		else if (entry.isFile()) files.push(relative)
	}
	return files
}

export class WorkspaceCheckpointService {
	constructor(private readonly store: CheckpointStore) {}

	async create(workspace: Workspace, userId: string, label: string): Promise<Checkpoint> {
		const service = new WorkspaceFileService(workspace.rootPath, [".git", ".adtec"])
		const relativePaths = await collectFiles(workspace.rootPath)
		const files: Record<string, string> = {}
		for (const relativePath of relativePaths) {
			try {
				files[relativePath] = await service.read(relativePath)
			} catch (error) {
				if (!String((error as Error).message).includes("ignored")) throw error
			}
		}
		const checkpoint: Checkpoint = {
			id: randomUUID(),
			workspaceId: workspace.id,
			createdBy: userId,
			createdAt: new Date().toISOString(),
			label,
			files,
		}
		await this.store.saveCheckpoint(checkpoint)
		return checkpoint
	}

	async restore(workspace: Workspace, checkpointId: string): Promise<FileChange[]> {
		const checkpoint = await this.store.getCheckpoint(checkpointId)
		if (!checkpoint || checkpoint.workspaceId !== workspace.id) throw new Error("Checkpoint is not available for this workspace")
		const service = new WorkspaceFileService(workspace.rootPath, [".git", ".adtec"])
		const current = await collectFiles(workspace.rootPath)
		const changes: FileChange[] = []
		for (const relativePath of current) {
			if (!(relativePath in checkpoint.files)) {
				try {
					changes.push(await service.delete(relativePath))
				} catch (error) {
					if (!String((error as Error).message).includes("ignored")) throw error
				}
			}
		}
		for (const [relativePath, content] of Object.entries(checkpoint.files)) changes.push(await service.write(relativePath, content))
		return changes
	}
}
