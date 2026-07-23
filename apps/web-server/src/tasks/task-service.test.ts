import { describe, expect, it } from "vitest"
import type { Workspace } from "../domain.js"
import { MemoryStore } from "../store/memory.js"
import { AgentScheduler, TaskEventBus, TaskService } from "./task-service.js"

const workspace: Workspace = { id: "ws1", organizationId: "org1", name: "Test", rootPath: "/tmp/project", createdBy: "u1", createdAt: new Date().toISOString() }

describe("task events and agent scheduler", () => {
	it("publishes lifecycle and agent events", async () => {
		const store = new MemoryStore()
		const events = new TaskEventBus(store)
		const tasks = new TaskService(store, events)
		const task = await tasks.create(workspace, "u1", "inspect files")
		const received: string[] = []
		const unsubscribe = events.subscribe(task.id, (event) => received.push(event.type))
		await new AgentScheduler(tasks, events).run(task, workspace, async (_context, publish) => {
			await publish({ type: "message", data: { text: "done" } })
		})
		unsubscribe()
		expect(received).toEqual(["status", "message", "status"])
		expect((await tasks.get(task.id))?.status).toBe("completed")
	})

	it("enforces the concurrent task limit", async () => {
		const store = new MemoryStore()
		const events = new TaskEventBus(store)
		const tasks = new TaskService(store, events)
		const scheduler = new AgentScheduler(tasks, events, 1)
		const first = await tasks.create(workspace, "u1", "first")
		const second = await tasks.create(workspace, "u1", "second")
		let release!: () => void
		const hold = new Promise<void>((resolve) => (release = resolve))
		const running = scheduler.run(first, workspace, async () => hold)
		await expect(scheduler.run(second, workspace, async () => undefined)).rejects.toThrow("capacity")
		release()
		await running
	})
})
