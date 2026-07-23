export interface Workspace {
	id: string
	organizationId: string
	name: string
	createdAt: string
}

export interface FileChange {
	path: string
	operation: string
	diff: Array<{ type: "context" | "add" | "remove"; line: number; text: string }>
}

export interface Task {
	id: string
	workspaceId: string
	status: string
	prompt: string
}

export class ApiError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

export class WebApi {
	constructor(private readonly baseUrl: string, private readonly token: string) {}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			...init,
			headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json", ...init.headers },
		})
		const payload = (await response.json()) as T & { error?: string }
		if (!response.ok) throw new ApiError(response.status, payload.error ?? "请求失败")
		return payload
	}

	async listWorkspaces(): Promise<Workspace[]> {
		return (await this.request<{ workspaces: Workspace[] }>("/v1/workspaces")).workspaces
	}

	async readFile(workspaceId: string, filePath: string): Promise<string> {
		return (await this.request<{ content: string }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/files?path=${encodeURIComponent(filePath)}`)).content
	}

	async writeFile(workspaceId: string, filePath: string, content: string): Promise<FileChange> {
		return (await this.request<{ change: FileChange }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/files`, { method: "PUT", body: JSON.stringify({ path: filePath, content }) })).change
	}

	async applyPatch(workspaceId: string, patch: string): Promise<FileChange[]> {
		return (await this.request<{ changes: FileChange[] }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/patch`, { method: "POST", body: JSON.stringify({ patch }) })).changes
	}

	async createTask(workspaceId: string, prompt: string): Promise<Task> {
		return (await this.request<{ task: Task }>("/v1/tasks", { method: "POST", body: JSON.stringify({ workspaceId, prompt }) })).task
	}

	subscribeTask(taskId: string, onEvent: (event: MessageEvent) => void): { close: () => void } {
		const controller = new AbortController()
		void fetch(`${this.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}/events`, { headers: { authorization: `Bearer ${this.token}` }, signal: controller.signal }).then(async (response) => {
			if (!response.ok || !response.body) throw new ApiError(response.status, "任务事件流连接失败")
			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			while (!controller.signal.aborted) {
				const chunk = await reader.read()
				if (chunk.done) break
				buffer += decoder.decode(chunk.value, { stream: true })
				const frames = buffer.split("\n\n")
				buffer = frames.pop() ?? ""
				for (const frame of frames) {
					const type = frame.match(/^event: (.+)$/m)?.[1] ?? "message"
					const data = frame.match(/^data: (.+)$/m)?.[1] ?? ""
					if (data) onEvent(new MessageEvent(type, { data }))
				}
			}
		}).catch(() => undefined)
		return { close: () => controller.abort() }
	}
}
