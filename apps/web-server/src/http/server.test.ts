import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createInMemoryApp } from "../index.js"

describe("web HTTP API", () => {
	it("enforces sessions and exposes file and task operations", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "adtec-web-http-"))
		const app = createInMemoryApp(root)
		await writeFile(path.join(root, "README.md"), "before", "utf8")
		await app.stores.saveSession({ token: "test-token", userId: "user-demo", expiresAt: Date.now() + 60_000 })
		await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve))
		const address = app.server.address()
		if (!address || typeof address === "string") throw new Error("Test server did not bind")
		const base = `http://127.0.0.1:${address.port}`
		try {
			expect((await fetch(`${base}/v1/me`)).status).toBe(401)
			expect((await fetch(`${base}/healthz`)).status).toBe(200)
			const headers = { authorization: "Bearer test-token", "content-type": "application/json" }
			const readResponse = await fetch(`${base}/v1/workspaces/workspace-demo/files?path=README.md`, { headers })
			expect(await readResponse.json()).toMatchObject({ content: "before" })
			const writeResponse = await fetch(`${base}/v1/workspaces/workspace-demo/files`, { method: "PUT", headers, body: JSON.stringify({ path: "README.md", content: "after" }) })
			expect(writeResponse.status).toBe(200)
			expect(await readFile(path.join(root, "README.md"), "utf8")).toBe("after")
			const taskResponse = await fetch(`${base}/v1/tasks`, { method: "POST", headers, body: JSON.stringify({ workspaceId: "workspace-demo", prompt: "check" }) })
			expect(taskResponse.status).toBe(202)
		} finally {
			await new Promise<void>((resolve, reject) => app.server.close((error) => (error ? reject(error) : resolve())))
			await rm(root, { recursive: true, force: true })
		}
	})
})
