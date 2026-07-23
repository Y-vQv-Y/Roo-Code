import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { Workspace } from "../domain.js"
import { MemoryStore } from "../store/memory.js"
import { WorkspaceCheckpointService } from "./checkpoints.js"

describe("workspace checkpoints", () => {
	it("restores file contents and removes files created after the checkpoint", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "adtec-web-checkpoint-"))
		try {
			await writeFile(path.join(root, "main.txt"), "before", "utf8")
			const workspace: Workspace = { id: "ws1", organizationId: "org1", name: "Test", rootPath: root, createdBy: "u1", createdAt: new Date().toISOString() }
			const service = new WorkspaceCheckpointService(new MemoryStore())
			const checkpoint = await service.create(workspace, "u1", "before changes")
			await writeFile(path.join(root, "main.txt"), "after", "utf8")
			await writeFile(path.join(root, "extra.txt"), "extra", "utf8")
			await service.restore(workspace, checkpoint.id)
			expect(await readFile(path.join(root, "main.txt"), "utf8")).toBe("before")
			await expect(readFile(path.join(root, "extra.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" })
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})
