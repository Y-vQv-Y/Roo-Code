import type { ModelInfo } from "../model.js"

// https://platform.moonshot.ai/docs/models
export type MoonshotModelId = keyof typeof moonshotModels

export const moonshotDefaultBaseUrl = "https://api.moonshot.cn/v1"
export const moonshotInternationalBaseUrl = "https://api.moonshot.ai/v1"
export const moonshotDefaultModelId: MoonshotModelId = "kimi-k3"

export const moonshotModels = {
	"kimi-k3": {
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
		preserveReasoning: true,
		description:
			"Kimi K3: Kimi's flagship model with native visual understanding, a 1M-token context window, and always-on thinking for long-horizon coding, knowledge work, and deep reasoning.",
	},
	"kimi-k2.7-code": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
		preserveReasoning: true,
		inputPrice: 0.95,
		outputPrice: 4,
		cacheReadsPrice: 0.19,
		description:
			"Kimi K2.7 Code: coding-focused model with text, image, and video input, 256K context, and always-on preserved thinking.",
	},
	"kimi-k2.7-code-highspeed": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
		preserveReasoning: true,
		inputPrice: 1.9,
		outputPrice: 8,
		cacheReadsPrice: 0.38,
		description:
			"Kimi K2.7 Code High-Speed: the K2.7 Code model with the same capabilities and parameter constraints, optimized for higher output speed.",
	},
	"kimi-k2.6": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
		supportsReasoningBinary: true,
		preserveReasoning: true,
		inputPrice: 0.95,
		outputPrice: 4,
		cacheReadsPrice: 0.16,
		description:
			"Kimi K2.6: multimodal 256K-context model supporting text and image input, thinking and non-thinking modes, dialogue, and agent tasks.",
	},
	"kimi-k2-0711-preview": {
		deprecated: true,
		maxTokens: 32_000,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.6, // $0.60 per million tokens (cache miss)
		outputPrice: 2.5, // $2.50 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.15, // $0.15 per million tokens (cache hit)
		description: `Kimi K2 is a state-of-the-art mixture-of-experts (MoE) language model with 32 billion activated parameters and 1 trillion total parameters.`,
	},
	"kimi-k2-0905-preview": {
		deprecated: true,
		maxTokens: 16384,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheReadsPrice: 0.15,
		description:
			"Kimi K2 model gets a new version update: Agentic coding: more accurate, better generalization across scaffolds. Frontend coding: improved aesthetics and functionalities on web, 3d, and other tasks. Context length: extended from 128k to 256k, providing better long-horizon support.",
	},
	"kimi-k2-turbo-preview": {
		deprecated: true,
		maxTokens: 32_000,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 2.4, // $2.40 per million tokens (cache miss)
		outputPrice: 10, // $10.00 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.6, // $0.60 per million tokens (cache hit)
		description: `Kimi K2 Turbo is a high-speed version of the state-of-the-art Kimi K2 mixture-of-experts (MoE) language model, with the same 32 billion activated parameters and 1 trillion total parameters, optimized for output speeds of up to 60 tokens per second, peaking at 100 tokens per second.`,
	},
	"kimi-k2-thinking": {
		deprecated: true,
		maxTokens: 16_000, // Recommended ≥ 16,000
		contextWindow: 262_144, // 262,144 tokens
		supportsImages: false, // Text-only (no image/vision support)
		supportsPromptCache: true,
		inputPrice: 0.6, // $0.60 per million tokens (cache miss)
		outputPrice: 2.5, // $2.50 per million tokens
		cacheWritesPrice: 0, // $0 per million tokens (cache miss)
		cacheReadsPrice: 0.15, // $0.15 per million tokens (cache hit)
		supportsTemperature: true, // Default temperature: 1.0
		preserveReasoning: true,
		defaultTemperature: 1.0,
		description: `The kimi-k2-thinking model is a general-purpose agentic reasoning model developed by Moonshot AI. Thanks to its strength in deep reasoning and multi-turn tool use, it can solve even the hardest problems.`,
	},
	"kimi-k2.5": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
		supportsReasoningBinary: true,
		preserveReasoning: true,
		inputPrice: 0.6,
		outputPrice: 3,
		cacheReadsPrice: 0.1,
		description:
			"Kimi K2.5: multimodal 256K-context model supporting text and image input, thinking and non-thinking modes, dialogue, and agent tasks.",
	},
} as const satisfies Record<string, ModelInfo>

/** Conservative metadata for newly discovered Kimi model IDs. */
export const moonshotModelInfoSaneDefaults: ModelInfo = {
	maxTokens: 16_384,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: true,
	supportsTemperature: false,
	metadataSource: "fallback",
	capabilityConfidence: "unknown",
}

/** Resolve metadata for IDs returned by Moonshot's OpenAI-compatible /models endpoint. */
export const getMoonshotModelInfo = (modelId: string): ModelInfo => {
	const staticInfo = moonshotModels[modelId as keyof typeof moonshotModels]
	if (staticInfo) {
		return staticInfo
	}

	const v1Match = modelId.match(/^moonshot-v1-(8k|32k|128k)(-vision-preview)?$/)
	if (v1Match) {
		const contextSize = v1Match[1]
		if (!contextSize) return moonshotModelInfoSaneDefaults

		const contextWindow = Number(contextSize.replace("k", "")) * 1_024
		return {
			...moonshotModelInfoSaneDefaults,
			maxTokens: contextWindow,
			contextWindow,
			supportsImages: Boolean(v1Match[2]),
			supportsPromptCache: true,
			supportsTemperature: true,
			defaultTemperature: 0,
			description: v1Match[2]
				? `Moonshot V1 vision model for understanding image content with a ${contextSize.toUpperCase()} context window.`
				: `Moonshot V1 model for generating long-form text with a ${contextSize.toUpperCase()} context window.`,
		}
	}

	return moonshotModelInfoSaneDefaults
}

export const MOONSHOT_DEFAULT_TEMPERATURE = 0.6
