import {
	moonshotDefaultModelId,
	getMoonshotModelInfo,
	type ModelInfo,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import {
	OpenAICompatibleHandler,
	OpenAICompatibleConfig,
	type OpenAICompatibleProviderOptions,
} from "./openai-compatible"

export class MoonshotHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? moonshotDefaultModelId
		const modelInfo = getMoonshotModelInfo(modelId)

		const config: OpenAICompatibleConfig = {
			providerName: "moonshot",
			baseURL: options.moonshotBaseUrl || "https://api.moonshot.ai/v1",
			apiKey: options.moonshotApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? moonshotDefaultModelId
		const info = this.options.modelInfoOverrides?.[`moonshot/${id}`] ?? getMoonshotModelInfo(id)
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	protected override getProviderOptions(model: {
		id: string
		info: ModelInfo
	}): OpenAICompatibleProviderOptions | undefined {
		// Kimi exposes model-specific fields through the OpenAI-compatible body.
		if (model.id === "kimi-k3") {
			return { reasoning_effort: "max" }
		}

		if (model.id === "kimi-k2.7-code" || model.id === "kimi-k2.7-code-highspeed") {
			return { thinking: { type: "enabled", keep: "all" } }
		}

		if (model.id === "kimi-k2.6" || model.id === "kimi-k2.5") {
			return { thinking: { type: this.options.enableReasoningEffort === false ? "disabled" : "enabled" } }
		}

		return undefined
	}

	/**
	 * Override to handle Moonshot's usage metrics, including caching.
	 * Moonshot returns cached_tokens in a different location than standard OpenAI.
	 */
	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		// Moonshot uses cached_tokens at the top level of raw usage data
		const rawUsage = usage.raw as { cached_tokens?: number } | undefined

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheWriteTokens: 0,
			cacheReadTokens: rawUsage?.cached_tokens ?? usage.details?.cachedInputTokens,
		}
	}

}
