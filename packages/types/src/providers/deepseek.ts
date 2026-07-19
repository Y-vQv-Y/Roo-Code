import type { ModelInfo } from "../model.js"

// https://api-docs.deepseek.com/quick_start/pricing
// https://api-docs.deepseek.com/guides/anthropic_api
export type DeepSeekModelId = keyof typeof deepSeekModels

export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-v4-pro"

/**
 * DeepSeek keeps the OpenAI-compatible base URL stable while replacing the
 * deprecated V3 model aliases with the V4 model IDs.
 */
export const deepSeekModels = {
	"deepseek-v4-pro": {
		maxTokens: 384_000,
		contextWindow: 1_048_576,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		preserveReasoning: true,
		inputPrice: 0.435,
		outputPrice: 0.87,
		cacheWritesPrice: 0.435,
		cacheReadsPrice: 0.003625,
		description:
			"DeepSeek-V4-Pro: flagship 1M-context model with both thinking (default) and non-thinking modes. Supports JSON output and tool calls through the OpenAI-compatible and Anthropic APIs.",
	},
	"deepseek-v4-flash": {
		maxTokens: 384_000,
		contextWindow: 1_048_576,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBinary: true,
		preserveReasoning: true,
		inputPrice: 0.14,
		outputPrice: 0.28,
		cacheWritesPrice: 0.14,
		cacheReadsPrice: 0.0028,
		description:
			"DeepSeek-V4-Flash: faster 1M-context model with both thinking (default) and non-thinking modes. Supports JSON output and tool calls through the OpenAI-compatible and Anthropic APIs.",
	},
} as const satisfies Record<string, ModelInfo>

/** Conservative metadata for newly discovered DeepSeek model IDs. */
export const deepSeekModelInfoSaneDefaults: ModelInfo = {
	maxTokens: 16_384,
	contextWindow: 128_000,
	supportsImages: false,
	supportsPromptCache: true,
	supportsReasoningBinary: true,
	preserveReasoning: true,
	metadataSource: "fallback",
	capabilityConfidence: "unknown",
}

/** Legacy IDs are accepted in saved settings but routed to their V4 aliases. */
export const deepSeekLegacyModelAliases: Record<string, DeepSeekModelId> = {
	"deepseek-chat": "deepseek-v4-flash",
	"deepseek-reasoner": "deepseek-v4-flash",
}

export const normalizeDeepSeekModelId = (modelId?: string): string => {
	// Preserve IDs returned by the provider's /models endpoint. Only legacy
	// aliases are rewritten; unknown IDs must remain callable for new models.
	return (modelId && deepSeekLegacyModelAliases[modelId]) || modelId || deepSeekDefaultModelId
}

// https://api-docs.deepseek.com/quick_start/parameter_settings
export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.3
