import { describe, expect, it, vi } from "vitest"
import { WebApi } from "./api"

describe("WebApi", () => {
	it("sends the session token and reads workspace data", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ workspaces: [{ id: "ws1", name: "Demo" }] }), { status: 200 })))
		const workspaces = await new WebApi("http://localhost:8787", "token").listWorkspaces()
		expect(workspaces[0].id).toBe("ws1")
		expect(fetch).toHaveBeenCalledWith("http://localhost:8787/v1/workspaces", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer token" }) }))
		vi.unstubAllGlobals()
	})
})
