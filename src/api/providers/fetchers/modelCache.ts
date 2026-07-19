import * as path from "path"
import * as fsSync from "fs"
import { createHash } from "crypto"

import NodeCache from "node-cache"
import { z } from "zod"

import type { ProviderName, ModelRecord } from "@roo-code/types"
import { modelInfoSchema } from "@roo-code/types"

import { safeWriteJson } from "../../../utils/safeWriteJson"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../utils/storage"
import type { RouterName } from "../../../shared/api"

import { getOpenRouterModels } from "./openrouter"
import { getVercelAiGatewayModels } from "./vercel-ai-gateway"
import { getRequestyModels } from "./requesty"
import { getUnboundModels } from "./unbound"
import { getLiteLLMModels } from "./litellm"
import { GetModelsOptions } from "../../../shared/api"
import { getOllamaModels } from "./ollama"
import { getLMStudioModels } from "./lmstudio"
import { getPoeModels } from "./poe"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })
const memoryFreshness = new Map<string, number>()
const MODEL_CACHE_REVALIDATE_AFTER_MS = 15 * 60 * 1000

// Zod schema for validating ModelRecord structure from disk cache
const modelRecordSchema = z.record(z.string(), modelInfoSchema)

// Track in-flight refresh requests to prevent concurrent API calls for the same provider
// This prevents race conditions where multiple calls might overwrite each other's results
const inFlightRefresh = new Map<string, Promise<ModelRecord>>()

export type ModelCacheOptions = {
	provider: RouterName
	apiKey?: string
	baseUrl?: string
}

const endpointScopedProviders = new Set<RouterName>([
	"openrouter",
	"litellm",
	"requesty",
	"unbound",
	"ollama",
	"lmstudio",
	"poe",
])

const normalizeBaseUrl = (baseUrl?: string) => {
	if (!baseUrl?.trim()) return ""
	try {
		const url = new URL(baseUrl.trim())
		url.hash = ""
		url.pathname = url.pathname.replace(/\/+$/, "") || "/"
		return url.toString()
	} catch {
		return baseUrl.trim().replace(/\/+$/, "")
	}
}

const secretFingerprint = (value?: string) =>
	value ? createHash("sha256").update(value).digest("hex").slice(0, 16) : ""

const getCacheKey = (options: ModelCacheOptions): string => {
	if (!endpointScopedProviders.has(options.provider)) {
		return options.provider
	}
	const endpoint = endpointScopedProviders.has(options.provider) ? normalizeBaseUrl(options.baseUrl) : ""
	const credential = endpointScopedProviders.has(options.provider) ? secretFingerprint(options.apiKey) : ""
	const scope = [options.provider, endpoint, credential].join("|")
	return `${options.provider}_${createHash("sha256").update(scope).digest("hex").slice(0, 24)}`
}

async function writeModels(options: ModelCacheOptions, data: ModelRecord) {
	const key = getCacheKey(options)
	const filename = `${key}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
	await safeWriteJson(path.join(cacheDir, `${key}_models.meta.json`), { fetchedAt: Date.now() })
}

const readFetchedAt = (options: ModelCacheOptions): number | undefined => {
	const key = getCacheKey(options)
	const cached = memoryFreshness.get(key)
	if (cached !== undefined) return cached
	try {
		const cacheDir = getCacheDirectoryPathSync()
		if (!cacheDir) return undefined
		const metadataPath = path.join(cacheDir, `${key}_models.meta.json`)
		if (fsSync.existsSync(metadataPath)) {
			const metadata = JSON.parse(fsSync.readFileSync(metadataPath, "utf8")) as { fetchedAt?: unknown }
			if (typeof metadata.fetchedAt === "number") {
				memoryFreshness.set(key, metadata.fetchedAt)
				return metadata.fetchedAt
			}
		}

		const modelPath = path.join(cacheDir, `${key}_models.json`)
		if (fsSync.existsSync(modelPath)) {
			const fetchedAt = fsSync.statSync(modelPath).mtimeMs
			memoryFreshness.set(key, fetchedAt)
			return fetchedAt
		}
	} catch {
		return undefined
	}

	return undefined
}

const isStale = (options: ModelCacheOptions) => {
	const fetchedAt = readFetchedAt(options)
	return fetchedAt === undefined || Date.now() - fetchedAt >= MODEL_CACHE_REVALIDATE_AFTER_MS
}

/**
 * Fetch models from the provider API.
 * Extracted to avoid duplication between getModels() and refreshModels().
 *
 * @param options - Provider options for fetching models
 * @returns Fresh models from the provider API
 */
async function fetchModelsFromProvider(options: GetModelsOptions): Promise<ModelRecord> {
	const { provider } = options

	let models: ModelRecord

	switch (provider) {
		case "openrouter":
			models = await getOpenRouterModels({ openRouterBaseUrl: options.baseUrl })
			break
		case "requesty":
			// Requesty models endpoint requires an API key for per-user custom policies.
			models = await getRequestyModels(options.baseUrl, options.apiKey)
			break
		case "unbound":
			models = await getUnboundModels(options.apiKey)
			break
		case "litellm":
			// Type safety ensures apiKey and baseUrl are always provided for LiteLLM.
			models = await getLiteLLMModels(options.apiKey, options.baseUrl)
			break
		case "ollama":
			models = await getOllamaModels(options.baseUrl, options.apiKey)
			break
		case "lmstudio":
			models = await getLMStudioModels(options.baseUrl)
			break
		case "vercel-ai-gateway":
			models = await getVercelAiGatewayModels()
			break
		case "poe":
			models = await getPoeModels(options.apiKey, options.baseUrl)
			break
		default: {
			// Ensures router is exhaustively checked if RouterName is a strict union.
			const exhaustiveCheck: never = provider
			throw new Error(`Unknown provider: ${exhaustiveCheck}`)
		}
	}

	return models
}

/**
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * @param router - The router to fetch models from.
 * @param apiKey - Optional API key for the provider.
 * @param baseUrl - Optional provider endpoint used for endpoint-scoped discovery and cache isolation.
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	let models = getModelsFromCache(options)

	if (models) {
		if (isStale(options)) void refreshModels(options).catch(() => undefined)
		return models
	}

	try {
		models = await fetchModelsFromProvider(options)
		const modelCount = Object.keys(models).length

		// Only cache non-empty results to prevent persisting failed API responses.
		// Empty results could indicate API failure rather than "no models exist".
		if (modelCount > 0) {
			const key = getCacheKey(options)
			memoryCache.set(key, models)
			memoryFreshness.set(key, Date.now())

			await writeModels(options, models).catch((err) =>
				console.error(`[MODEL_CACHE] Error writing ${provider} models to file cache:`, err),
			)
		}

		return models
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models in modelCache for ${provider}:`, error)

		throw error // Re-throw the original error to be handled by the caller.
	}
}

/**
 * Force-refresh models from API, bypassing cache.
 * Uses atomic writes so cache remains available during refresh.
 * This function also prevents concurrent API calls for the same provider using
 * in-flight request tracking to avoid race conditions.
 *
 * @param options - Provider options for fetching models
 * @returns Fresh models from API, or existing cache if refresh yields worse data
 */
export const refreshModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	// Check if there's already an in-flight refresh for this provider
	// This prevents race conditions where multiple concurrent refreshes might
	// overwrite each other's results
	const key = getCacheKey(options)
	const existingRequest = inFlightRefresh.get(key)
	if (existingRequest) {
		return existingRequest
	}

	// Create the refresh promise and track it
	const refreshPromise = (async (): Promise<ModelRecord> => {
		try {
			// Force fresh API fetch - skip getModelsFromCache() check
			const models = await fetchModelsFromProvider(options)
			const modelCount = Object.keys(models).length

			// Get existing cached data for comparison
			const existingCache = getModelsFromCache(options)
			const existingCount = existingCache ? Object.keys(existingCache).length : 0

			if (modelCount === 0) {
				return existingCount > 0 ? existingCache! : {}
			}

			// Update memory cache first
			memoryCache.set(key, models)
			memoryFreshness.set(key, Date.now())

			// Atomically write to disk (safeWriteJson handles atomic writes)
			await writeModels(options, models).catch((err) =>
				console.error(`[refreshModels] Error writing ${provider} models to disk:`, err),
			)

			return models
		} catch (error) {
			// Log the error for debugging, then return existing cache if available (graceful degradation)
			console.error(`[refreshModels] Failed to refresh ${provider} models:`, error)
			return getModelsFromCache(options) || {}
		} finally {
			// Always clean up the in-flight tracking
			inFlightRefresh.delete(key)
		}
	})()

	// Track the in-flight request
	inFlightRefresh.set(key, refreshPromise)

	return refreshPromise
}

/**
 * Initialize background model cache refresh.
 * Refreshes public provider caches without blocking or requiring auth.
 * Should be called once during extension activation.
 */
export async function initializeModelCacheRefresh(): Promise<void> {
	// Wait for extension to fully activate before refreshing
	setTimeout(async () => {
		// Providers that work without API keys
		const publicProviders: Array<{ provider: RouterName; options: GetModelsOptions }> = [
			{ provider: "openrouter", options: { provider: "openrouter" } },
			{ provider: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
		]

		// Refresh each provider in background (fire and forget)
		for (const { options } of publicProviders) {
			refreshModels(options).catch(() => {
				// Silent fail - old cache remains available
			})

			// Small delay between refreshes to avoid API rate limits
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}, 2000)
}

/**
 * Flush models memory cache for a specific router.
 *
 * @param options - The options for fetching models, including provider, apiKey, and baseUrl
 * @param refresh - If true, immediately fetch fresh data from API
 */
export const flushModels = async (options: GetModelsOptions, refresh: boolean = false): Promise<void> => {
	const key = getCacheKey(options)
	if (refresh) {
		// Don't delete memory cache - let refreshModels atomically replace it
		// This prevents a race condition where getModels() might be called
		// before refresh completes, avoiding a gap in cache availability
		// Await the refresh to ensure the cache is updated before returning
		await refreshModels(options)
	} else {
		// Only delete memory cache when not refreshing
		memoryCache.del(key)
		memoryFreshness.delete(key)
	}
}

/**
 * Get models from cache, checking memory first, then disk.
 * This ensures providers always have access to last known good data,
 * preventing fallback to hardcoded defaults on startup.
 *
 * @param provider - The provider to get models for.
 * @returns Models from memory cache, disk cache, or undefined if not cached.
 */
export function getModelsFromCache(provider: ProviderName): ModelRecord | undefined
export function getModelsFromCache(options: ModelCacheOptions): ModelRecord | undefined
export function getModelsFromCache(providerOrOptions: ProviderName | ModelCacheOptions): ModelRecord | undefined {
	const options = typeof providerOrOptions === "string" ? { provider: providerOrOptions as RouterName } : providerOrOptions
	const key = getCacheKey(options)
	// Check memory cache first (fast)
	const memoryModels = memoryCache.get<ModelRecord>(key)
	if (memoryModels) {
		if (!memoryFreshness.has(key)) memoryFreshness.set(key, Date.now())
		return memoryModels
	}

	// Memory cache miss - try to load from disk synchronously
	// This is acceptable because it only happens on cold start or after cache expiry
	try {
		const filename = `${key}_models.json`
		const cacheDir = getCacheDirectoryPathSync()
		if (!cacheDir) {
			return undefined
		}

		const filePath = path.join(cacheDir, filename)

		// Use synchronous fs to avoid async complexity in getModel() callers
		if (fsSync.existsSync(filePath)) {
			const data = fsSync.readFileSync(filePath, "utf8")
			const models = JSON.parse(data)

			// Validate the disk cache data structure using Zod schema
			// This ensures the data conforms to ModelRecord = Record<string, ModelInfo>
			const validation = modelRecordSchema.safeParse(models)
			if (!validation.success) {
				console.error(
					`[MODEL_CACHE] Invalid disk cache data structure for ${options.provider}:`,
					validation.error.format(),
				)
				return undefined
			}

			// Populate memory cache for future fast access
			memoryCache.set(key, validation.data)
			readFetchedAt(options)

			return validation.data
		}
	} catch (error) {
		console.error(`[MODEL_CACHE] Error loading ${options.provider} models from disk:`, error)
	}

	return undefined
}

/**
 * Synchronous version of getCacheDirectoryPath for use in getModelsFromCache.
 * Returns the cache directory path without async operations.
 */
function getCacheDirectoryPathSync(): string | undefined {
	try {
		const globalStoragePath = ContextProxy.instance?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			return undefined
		}
		const cachePath = path.join(globalStoragePath, "cache")
		return cachePath
	} catch (error) {
		console.error(`[MODEL_CACHE] Error getting cache directory path:`, error)
		return undefined
	}
}
