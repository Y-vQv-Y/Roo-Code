import type { TaskEvent } from "../domain.js"

export interface RedisPublisher {
	publish(channel: string, message: string): Promise<number>
}

export interface RedisSubscriber {
	subscribe(channel: string, listener: (message: string) => void): Promise<() => Promise<void>>
}

export class RedisTaskEvents {
	constructor(private readonly publisher: RedisPublisher, private readonly subscriber: RedisSubscriber, private readonly prefix = "adtec:task-events") {}

	async publish(event: TaskEvent): Promise<void> {
		await this.publisher.publish(`${this.prefix}:${event.taskId}`, JSON.stringify(event))
	}

	async subscribe(taskId: string, listener: (event: TaskEvent) => void): Promise<() => Promise<void>> {
		return this.subscriber.subscribe(`${this.prefix}:${taskId}`, (message) => {
			const event = JSON.parse(message) as TaskEvent
			if (event.taskId === taskId) listener(event)
		})
	}
}
