import { getProviderDefaultModelId, type ProviderSettings } from "@roo-code/types"

import type { SupportedProvider } from "@/types/index.js"

const envVarMap: Record<SupportedProvider, string> = {
	anthropic: "ANTHROPIC_API_KEY",
	baseten: "BASETEN_API_KEY",
	deepseek: "DEEPSEEK_API_KEY",
	fireworks: "FIREWORKS_API_KEY",
	gemini: "GOOGLE_API_KEY",
	litellm: "LITELLM_API_KEY",
	lmstudio: "LM_STUDIO_API_KEY",
	minimax: "MINIMAX_API_KEY",
	mistral: "MISTRAL_API_KEY",
	moonshot: "MOONSHOT_API_KEY",
	ollama: "OLLAMA_API_KEY",
	openai: "OPENAI_API_KEY",
	"openai-native": "OPENAI_API_KEY",
	openrouter: "OPENROUTER_API_KEY",
	poe: "POE_API_KEY",
	requesty: "REQUESTY_API_KEY",
	sambanova: "SAMBANOVA_API_KEY",
	unbound: "UNBOUND_API_KEY",
	"vercel-ai-gateway": "VERCEL_AI_GATEWAY_API_KEY",
	xai: "XAI_API_KEY",
	zai: "ZAI_API_KEY",
}

export function getEnvVarName(provider: SupportedProvider): string {
	return envVarMap[provider]
}

export function getApiKeyFromEnv(provider: SupportedProvider): string | undefined {
	const envVar = getEnvVarName(provider)
	return process.env[envVar]
}

const providersWithCustomBaseUrl = new Set<SupportedProvider>([
	"anthropic",
	"deepseek",
	"gemini",
	"litellm",
	"lmstudio",
	"minimax",
	"mistral",
	"ollama",
	"openai",
	"openai-native",
	"openrouter",
	"poe",
	"requesty",
	"moonshot",
])

export function providerSupportsBaseUrl(provider: SupportedProvider): boolean {
	return providersWithCustomBaseUrl.has(provider)
}

export function validateProviderBaseUrl(provider: SupportedProvider, baseUrl: string | undefined): string | undefined {
	if (!baseUrl) return undefined

	if (!providerSupportsBaseUrl(provider)) {
		return `Provider ${provider} does not expose a custom base URL in ADTEC Code`
	}

	if (provider === "moonshot" && !["https://api.moonshot.ai/v1", "https://api.moonshot.cn/v1"].includes(baseUrl)) {
		return "Provider moonshot accepts only https://api.moonshot.ai/v1 or https://api.moonshot.cn/v1"
	}

	if (provider === "minimax" && !["https://api.minimax.io/v1", "https://api.minimaxi.com/v1"].includes(baseUrl)) {
		return "Provider minimax accepts only https://api.minimax.io/v1 or https://api.minimaxi.com/v1"
	}

	return undefined
}

export function getProviderSettings(
	provider: SupportedProvider,
	apiKey: string | undefined,
	model: string | undefined,
	baseUrl?: string,
): ProviderSettings {
	const config: ProviderSettings = { apiProvider: provider }
	const selectedModel = model || getProviderDefaultModelId(provider)

	switch (provider) {
		case "anthropic":
			if (apiKey) config.apiKey = apiKey
			if (baseUrl) config.anthropicBaseUrl = baseUrl
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "baseten":
			if (apiKey) config.basetenApiKey = apiKey
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "deepseek":
			if (apiKey) config.deepSeekApiKey = apiKey
			if (baseUrl) config.deepSeekBaseUrl = baseUrl
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "fireworks":
			if (apiKey) config.fireworksApiKey = apiKey
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "gemini":
			if (apiKey) config.geminiApiKey = apiKey
			if (baseUrl) config.googleGeminiBaseUrl = baseUrl
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "litellm":
			if (apiKey) config.litellmApiKey = apiKey
			if (baseUrl) config.litellmBaseUrl = baseUrl
			if (selectedModel) config.litellmModelId = selectedModel
			break
		case "lmstudio":
			if (baseUrl) config.lmStudioBaseUrl = baseUrl
			if (selectedModel) config.lmStudioModelId = selectedModel
			break
		case "minimax":
			if (apiKey) config.minimaxApiKey = apiKey
			if (baseUrl === "https://api.minimax.io/v1" || baseUrl === "https://api.minimaxi.com/v1") {
				config.minimaxBaseUrl = baseUrl
			}
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "mistral":
			if (apiKey) config.mistralApiKey = apiKey
			if (baseUrl) config.mistralCodestralUrl = baseUrl
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "moonshot":
			if (apiKey) config.moonshotApiKey = apiKey
			if (baseUrl === "https://api.moonshot.ai/v1" || baseUrl === "https://api.moonshot.cn/v1") {
				config.moonshotBaseUrl = baseUrl
			}
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "ollama":
			if (apiKey) config.ollamaApiKey = apiKey
			if (baseUrl) config.ollamaBaseUrl = baseUrl
			if (selectedModel) config.ollamaModelId = selectedModel
			break
		case "openai":
			if (apiKey) config.openAiApiKey = apiKey
			if (baseUrl) config.openAiBaseUrl = baseUrl
			if (selectedModel) config.openAiModelId = selectedModel
			break
		case "openai-native":
			if (apiKey) config.openAiNativeApiKey = apiKey
			if (baseUrl) config.openAiNativeBaseUrl = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "openrouter":
			if (apiKey) config.openRouterApiKey = apiKey
			if (baseUrl) config.openRouterBaseUrl = baseUrl
			if (selectedModel) config.openRouterModelId = selectedModel
			break
		case "poe":
			if (apiKey) config.poeApiKey = apiKey
			if (baseUrl) config.poeBaseUrl = baseUrl
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "requesty":
			if (apiKey) config.requestyApiKey = apiKey
			if (baseUrl) config.requestyBaseUrl = baseUrl
			if (selectedModel) config.requestyModelId = selectedModel
			break
		case "sambanova":
			if (apiKey) config.sambaNovaApiKey = apiKey
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "unbound":
			if (apiKey) config.unboundApiKey = apiKey
			if (selectedModel) config.unboundModelId = selectedModel
			break
		case "vercel-ai-gateway":
			if (apiKey) config.vercelAiGatewayApiKey = apiKey
			if (selectedModel) config.vercelAiGatewayModelId = selectedModel
			break
		case "xai":
			if (apiKey) config.xaiApiKey = apiKey
			if (selectedModel) config.apiModelId = selectedModel
			break
		case "zai":
			if (apiKey) config.zaiApiKey = apiKey
			if (selectedModel) config.apiModelId = selectedModel
			break
	}

	return config
}
