import { randomUUID } from "node:crypto"
import type { AgentExecutor, Task, TaskEvent, TaskStatus, Workspace } from "../domain.js"
import type { TaskStore } from "../store/contracts.js"

type EventListener = (event: TaskEvent) => void

export class TaskEventBus {
	private readonly listeners = new Map<string, Set<EventListener>>()

	constructor(private readonly store: TaskStore) {}

	async publish(taskId: string, type: TaskEvent["type"], data: Record<string, unknown>): Promise<TaskEvent> {
		const event: TaskEvent = { id: randomUUID(), taskId, type, data, createdAt: new Date().toISOString() }
		await this.store.appendTaskEvent(event)
		for (const listener of this.listeners.get(taskId) ?? []) listener(event)
		return event
	}

	subscribe(taskId: string, listener: EventListener): () => void {
		const listeners = this.listeners.get(taskId) ?? new Set<EventListener>()
		listeners.add(listener)
		this.listeners.set(taskId, listeners)
		return () => {
			listeners.delete(listener)
			if (listeners.size === 0) this.listeners.delete(taskId)
		}
	}
}

export class TaskService {
	constructor(private readonly store: TaskStore, private readonly events: TaskEventBus) {}

	async create(workspace: Workspace, createdBy: string, prompt: string): Promise<Task> {
		const now = new Date().toISOString()
		const task: Task = { id: randomUUID(), workspaceId: workspace.id, createdBy, prompt, status: "queued", createdAt: now, updatedAt: now, agentIds: [] }
		await this.store.saveTask(task)
		await this.events.publish(task.id, "status", { status: task.status })
		return task
	}

	async get(id: string): Promise<Task | undefined> {
		return this.store.getTask(id)
	}

	async eventsFor(id: string): Promise<TaskEvent[]> {
		return this.store.listTaskEvents(id)
	}

	async updateStatus(task: Task, status: TaskStatus, message?: string): Promise<Task> {
		const updated = { ...task, status, updatedAt: new Date().toISOString() }
		await this.store.saveTask(updated)
		await this.events.publish(task.id, "status", { status, ...(message ? { message } : {}) })
		return updated
	}
}

export class AgentScheduler {
	private readonly running = new Set<string>()

	constructor(private readonly tasks: TaskService, private readonly events: TaskEventBus, private readonly maxConcurrent = 4) {}

	async run(task: Task, workspace: Workspace, executor: AgentExecutor): Promise<void> {
		if (this.running.size >= this.maxConcurrent) throw new Error("Agent capacity is temporarily full")
		if (this.running.has(task.id)) throw new Error("Task is already running")
		this.running.add(task.id)
		let current = await this.tasks.updateStatus(task, "running")
		try {
			await executor({ task: current, workspace }, async (event) => this.events.publish(task.id, event.type, event.data))
			current = await this.tasks.updateStatus(current, "completed")
		} catch (error) {
			await this.tasks.updateStatus(current, "failed", error instanceof Error ? error.message : String(error))
			throw error
		} finally {
			this.running.delete(task.id)
		}
	}
}
