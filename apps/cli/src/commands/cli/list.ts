import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import pWaitFor from "p-wait-for"

import type { TaskSessionEntry } from "@roo-code/core/cli"
import type { Command, ModelRecord, SkillMetadata, WebviewMessage } from "@roo-code/types"
import { getProviderDefaultModelId, getStaticProviderModels, isDynamicProvider } from "@roo-code/types"

import { ExtensionHost, type ExtensionHostOptions } from "@/agent/index.js"
import { readWorkspaceTaskSessions } from "@/lib/task-history/index.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"
import { getApiKeyFromEnv } from "@/lib/utils/provider.js"
import { isRecord } from "@/lib/utils/guards.js"
import { isSupportedProvider, providerRequiresApiKey, type SupportedProvider } from "@/types/index.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REQUEST_TIMEOUT_MS = 10_000

type ListFormat = "json" | "text"

type BaseListOptions = {
	workspace?: string
	extension?: string
	apiKey?: string
	baseUrl?: string
	provider?: string
	format?: string
	debug?: boolean
}

type CommandLike = Pick<Command, "name" | "source" | "filePath" | "description" | "argumentHint">
type ModeLike = { slug: string; name: string }
type SessionLike = TaskSessionEntry
type SkillLike = Pick<SkillMetadata, "name" | "description" | "source" | "modeSlugs">
type ListHostOptions = { ephemeral: boolean }

export function parseFormat(rawFormat: string | undefined): ListFormat {
	const format = (rawFormat ?? "json").toLowerCase()
	if (format === "json" || format === "text") {
		return format
	}

	throw new Error(`Invalid format: ${rawFormat}. Must be "json" or "text".`)
}

function resolveWorkspacePath(workspace: string | undefined): string {
	const resolved = workspace ? path.resolve(workspace) : process.cwd()

	if (!fs.existsSync(resolved)) {
		throw new Error(`Workspace path does not exist: ${resolved}`)
	}

	return resolved
}

function resolveExtensionPath(extension: string | undefined): string {
	const resolved = path.resolve(extension || getDefaultExtensionPath(__dirname))

	if (!fs.existsSync(path.join(resolved, "extension.js"))) {
		throw new Error(`Extension bundle not found at: ${resolved}`)
	}

	return resolved
}

function outputJson(data: unknown): void {
	process.stdout.write(JSON.stringify(data, null, 2) + "\n")
}

function outputCommandsText(commands: CommandLike[]): void {
	for (const command of commands) {
		const description = command.description ? ` - ${command.description}` : ""
		process.stdout.write(`/${command.name} (${command.source})${description}\n`)
	}
}

function outputModesText(modes: ModeLike[]): void {
	for (const mode of modes) {
		process.stdout.write(`${mode.slug}\t${mode.name}\n`)
	}
}

function outputModelsText(models: ModelRecord): void {
	for (const [modelId, info] of Object.entries(models).sort(([a], [b]) => a.localeCompare(b))) {
		const status = info.status ? `\t${info.status}` : ""
		const confidence = info.capabilityConfidence ?? (info.metadataSource === "provider" ? "provider-reported" : "catalog")
		process.stdout.write(
			`${modelId}\tcontext=${info.contextWindow}\tmax_output=${info.maxTokens ?? "unknown"}\tconfidence=${confidence}${status}\n`,
		)
	}
}

function enrichDiscoveredModels(discovered: ModelRecord, catalog: ModelRecord | undefined): ModelRecord {
	return Object.fromEntries(
		Object.entries(discovered).map(([modelId, reported]) => {
			const known = catalog?.[modelId]
			if (!known) return [modelId, reported]

			if (reported.capabilityConfidence !== "provider-reported") {
				return [modelId, { ...known, status: reported.status ?? known.status }]
			}

			return [
				modelId,
				{
					...known,
					contextWindow: reported.contextWindow,
					contextWindowConfig: reported.contextWindowConfig ?? known.contextWindowConfig,
					maxTokens: reported.maxTokens ?? known.maxTokens,
					description: reported.description ?? known.description,
					status: reported.status ?? known.status,
					metadataSource: reported.metadataSource,
					metadataUpdatedAt: reported.metadataUpdatedAt,
					capabilityConfidence: reported.capabilityConfidence,
				},
			]
		}),
	)
}

function outputSkillsText(skills: SkillLike[]): void {
	for (const skill of skills) {
		const modes = skill.modeSlugs?.length ? skill.modeSlugs.join(",") : "all"
		process.stdout.write(`${skill.name}\t${skill.source}\tmodes=${modes}\t${skill.description}\n`)
	}
}

function formatSessionTitle(task: string): string {
	const compact = task.replace(/\s+/g, " ").trim()

	if (!compact) {
		return "(untitled)"
	}

	return compact.length <= 120 ? compact : `${compact.slice(0, 117)}...`
}

function outputSessionsText(sessions: SessionLike[]): void {
	for (const session of sessions) {
		const startedAt = Number.isFinite(session.ts) ? new Date(session.ts).toISOString() : "unknown-time"
		process.stdout.write(`${session.id}\t${startedAt}\t${formatSessionTitle(session.task)}\n`)
	}
}

async function createListHost(options: BaseListOptions, hostOptions: ListHostOptions): Promise<ExtensionHost> {
	const workspacePath = resolveWorkspacePath(options.workspace)
	const extensionPath = resolveExtensionPath(options.extension)
	const provider = resolveProvider(options.provider)
	const apiKey = options.apiKey || getApiKeyFromEnv(provider)

	const extensionHostOptions: ExtensionHostOptions = {
		mode: "code",
		reasoningEffort: undefined,
		user: null,
		provider,
		model: getProviderDefaultModelId(provider),
		apiKey,
		baseUrl: options.baseUrl,
		workspacePath,
		extensionPath,
		nonInteractive: true,
		ephemeral: hostOptions.ephemeral,
		debug: options.debug ?? false,
		exitOnComplete: true,
		exitOnError: false,
		disableOutput: true,
	}

	const host = new ExtensionHost(extensionHostOptions)

	await host.activate()

	// Best effort wait; mode/commands requests can still succeed without this.
	await pWaitFor(() => host.client.isInitialized(), {
		interval: 25,
		timeout: 2_000,
	}).catch(() => undefined)

	return host
}

function resolveProvider(provider: string | undefined): SupportedProvider {
	const resolved = provider ?? "openrouter"
	if (!isSupportedProvider(resolved)) {
		throw new Error(`Unsupported CLI provider: ${resolved}`)
	}
	return resolved
}

/**
 * Send a request to the extension and wait for a matching response message.
 * Returns `undefined` from `extract` to skip non-matching messages, or the
 * parsed value to resolve the promise.
 */
function requestFromExtension<T>(
	host: ExtensionHost,
	request: WebviewMessage,
	extract: (message: Record<string, unknown>) => T | undefined,
): Promise<T> {
	const requestType = request.type
	return new Promise<T>((resolve, reject) => {
		let settled = false

		const cleanup = () => {
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
			offError()
		}

		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			cleanup()
			fn()
		}

		const onMessage = (message: unknown) => {
			if (!isRecord(message)) {
				return
			}

			let result: T | undefined
			try {
				result = extract(message)
			} catch (error) {
				finish(() => reject(error instanceof Error ? error : new Error(String(error))))
				return
			}

			if (result !== undefined) {
				finish(() => resolve(result))
			}
		}

		const offError = host.client.on("error", (error) => {
			finish(() => reject(error))
		})

		const timeoutId = setTimeout(() => {
			finish(() =>
				reject(new Error(`Timed out waiting for ${requestType} response after ${REQUEST_TIMEOUT_MS}ms`)),
			)
		}, REQUEST_TIMEOUT_MS)

		host.on("extensionWebviewMessage", onMessage)
		host.sendToExtension(request)
	})
}

function requestCommands(host: ExtensionHost): Promise<CommandLike[]> {
	return requestFromExtension(host, { type: "requestCommands" }, (message) => {
		if (message.type !== "commands") {
			return undefined
		}
		return Array.isArray(message.commands) ? (message.commands as CommandLike[]) : []
	})
}

function requestModes(host: ExtensionHost): Promise<ModeLike[]> {
	return requestFromExtension(host, { type: "requestModes" }, (message) => {
		if (message.type !== "modes") {
			return undefined
		}
		return Array.isArray(message.modes) ? (message.modes as ModeLike[]) : []
	})
}

function requestRouterModels(host: ExtensionHost, provider: SupportedProvider): Promise<ModelRecord> {
	return requestFromExtension(host, { type: "requestRouterModels", values: { provider, refresh: true } }, (message) => {
		if (message.type !== "routerModels") {
			return undefined
		}

		const routerModels = isRecord(message.routerModels) ? message.routerModels : {}
		const providerModels = routerModels[provider]
		return isRecord(providerModels) ? (providerModels as ModelRecord) : {}
	})
}

function requestOpenAiCompatibleModels(
	host: ExtensionHost,
	provider: "openai" | "openai-native" | "deepseek" | "moonshot",
	baseUrl: string,
	apiKey: string,
): Promise<ModelRecord> {
	return requestFromExtension(
		host,
		{ type: "requestOpenAiModels", values: { provider, baseUrl, apiKey } },
		(message) => {
			const values = isRecord(message.values) ? message.values : undefined
			if (message.type !== "openAiModels" || values?.provider !== provider) return undefined
			return isRecord(message.openAiModelInfo) ? (message.openAiModelInfo as ModelRecord) : {}
		},
	)
}

function requestLocalModels(host: ExtensionHost, provider: "ollama" | "lmstudio"): Promise<ModelRecord> {
	const requestType = provider === "ollama" ? "requestOllamaModels" : "requestLmStudioModels"
	const responseType = provider === "ollama" ? "ollamaModels" : "lmStudioModels"
	const responseField = provider === "ollama" ? "ollamaModels" : "lmStudioModels"
	return requestFromExtension(host, { type: requestType }, (message) => {
		if (message.type !== responseType) return undefined
		const models = message[responseField]
		return isRecord(models) ? (models as ModelRecord) : {}
	})
}

function requestSkills(host: ExtensionHost): Promise<SkillLike[]> {
	return requestFromExtension(host, { type: "requestSkills" }, (message) => {
		if (message.type !== "skills") return undefined
		return Array.isArray(message.skills) ? (message.skills as SkillLike[]) : []
	})
}

async function withHostAndSignalHandlers<T>(
	options: BaseListOptions,
	hostOptions: ListHostOptions,
	fn: (host: ExtensionHost) => Promise<T>,
): Promise<T> {
	const host = await createListHost(options, hostOptions)

	const shutdown = async (exitCode: number) => {
		await host.dispose()
		process.exit(exitCode)
	}

	const onSigint = () => void shutdown(130)
	const onSigterm = () => void shutdown(143)

	process.on("SIGINT", onSigint)
	process.on("SIGTERM", onSigterm)

	try {
		return await fn(host)
	} finally {
		process.off("SIGINT", onSigint)
		process.off("SIGTERM", onSigterm)
		await host.dispose()
	}
}

export async function listCommands(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)

	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const commands = await requestCommands(host)

		if (format === "json") {
			outputJson({ commands })
			return
		}

		outputCommandsText(commands)
	})
}

export async function listModes(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)

	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const modes = await requestModes(host)

		if (format === "json") {
			outputJson({ modes })
			return
		}

		outputModesText(modes)
	})
}

export async function listModels(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	const provider = resolveProvider(options.provider)
	// Z.ai's international catalog is the default line in the VS Code settings.
	// Mainland coding models require an explicit API-line setting, which the CLI
	// does not silently infer from the provider name.
	const staticModels = getStaticProviderModels(provider, { isChina: false })
	const apiKey = options.apiKey || getApiKeyFromEnv(provider)

	if (staticModels && !(apiKey && (provider === "deepseek" || provider === "moonshot" || provider === "openai-native"))) {
		if (format === "json") outputJson({ provider, source: "catalog", models: staticModels })
		else outputModelsText(staticModels)
		return
	}

	if (providerRequiresApiKey(provider) && !apiKey && provider !== "openrouter" && provider !== "vercel-ai-gateway") {
		throw new Error(`No API key provided for ${provider}`)
	}

	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		let models: ModelRecord
		let source: "provider" | "catalog-fallback" = "provider"
		if (isDynamicProvider(provider)) {
			models = await requestRouterModels(host, provider)
		} else if (provider === "ollama" || provider === "lmstudio") {
			models = await requestLocalModels(host, provider)
		} else if (
			provider === "openai" ||
			provider === "openai-native" ||
			provider === "deepseek" ||
			provider === "moonshot"
		) {
			const configuredBaseUrl = options.baseUrl?.replace(/\/+$/, "")
			const baseUrl =
				provider === "openai-native"
					? configuredBaseUrl
						? configuredBaseUrl.endsWith("/v1")
							? configuredBaseUrl
							: `${configuredBaseUrl}/v1`
						: "https://api.openai.com/v1"
					: configuredBaseUrl ||
						(provider === "openai"
							? "https://api.openai.com/v1"
							: provider === "deepseek"
								? "https://api.deepseek.com"
								: "https://api.moonshot.ai/v1")
			const discovered = await requestOpenAiCompatibleModels(host, provider, baseUrl, apiKey!)
			if (Object.keys(discovered).length > 0) {
				models = enrichDiscoveredModels(discovered, staticModels)
			} else {
				models = staticModels ?? {}
				source = "catalog-fallback"
			}
		} else {
			models = staticModels ?? {}
		}

		if (format === "json") {
			outputJson({ provider, source, models })
			return
		}

		outputModelsText(models)
	})
}

export async function listSkills(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const skills = await requestSkills(host)
		if (format === "json") outputJson({ skills })
		else outputSkillsText(skills)
	})
}

export async function listSessions(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	const workspacePath = resolveWorkspacePath(options.workspace)
	const sessions = await readWorkspaceTaskSessions(workspacePath)

	if (format === "json") {
		outputJson({ workspace: workspacePath, sessions })
		return
	}

	outputSessionsText(sessions)
}
