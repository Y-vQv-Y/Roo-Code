import { useMemo } from "react"

import {
	type ModelInfo,
	type ProviderName,
	type ProviderSettings,
	CONTEXT_WINDOW_PRESETS,
	getModelContextWindow,
} from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

type ContextWindowSettingProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	modelInfo?: ModelInfo
	provider?: ProviderName
	modelId?: string
}

const formatTokens = (tokens: number) => {
	if (tokens >= 1_000_000) return `${Math.round(tokens / 10_000) / 100}M`
	if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
	return tokens.toLocaleString()
}

/**
 * Selects the effective context budget used by context management. The
 * provider's real model limit is always the upper bound for these options.
 */
export const ContextWindowSetting = ({
	apiConfiguration,
	setApiConfigurationField,
	modelInfo,
	provider,
	modelId,
}: ContextWindowSettingProps) => {
	const { t } = useAppTranslation()
	const overrideKey = provider && modelId ? `${provider}/${modelId}` : undefined

	const options = useMemo(
		() =>
			CONTEXT_WINDOW_PRESETS.filter(
				(preset) =>
					!!modelInfo &&
					preset >= (modelInfo.contextWindowConfig?.min ?? 1) &&
					preset <= Math.min(modelInfo.contextWindow, modelInfo.contextWindowConfig?.max ?? modelInfo.contextWindow),
			),
		[modelInfo],
	)

	if (!modelInfo || options.length === 0) {
		return null
	}

	const configuredValue = getModelContextWindow(apiConfiguration, provider, modelId)
	const selectedValue = configuredValue && options.includes(configuredValue as (typeof CONTEXT_WINDOW_PRESETS)[number])
		? String(configuredValue)
		: "auto"
	const handleValueChange = (value: string) => {
		const nextValue = value === "auto" ? undefined : Number(value)
		setApiConfigurationField("modelContextWindow", nextValue)
		if (provider === "ollama") {
			setApiConfigurationField("ollamaNumCtx", nextValue)
		}
		if (overrideKey) {
			const overrides = { ...(apiConfiguration.modelContextWindowOverrides ?? {}) }
			if (nextValue === undefined) delete overrides[overrideKey]
			else overrides[overrideKey] = nextValue
			setApiConfigurationField("modelContextWindowOverrides", overrides)
		}
	}

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium">
				{t("settings:contextWindow.label", { defaultValue: "Context window" })}
			</label>
			<Select
				value={selectedValue}
				onValueChange={handleValueChange}>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="auto">
						{t("settings:contextWindow.auto", {
							value: formatTokens(modelInfo.contextWindow),
							defaultValue: `Auto (${formatTokens(modelInfo.contextWindow)})`,
						})}
					</SelectItem>
					{options.map((preset) => (
						<SelectItem key={preset} value={String(preset)}>
							{formatTokens(preset)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:contextWindow.description", {
					defaultValue: "Controls when conversation history is compressed. The provider limit is always enforced.",
				})}
				{modelInfo.capabilityConfidence === "unknown" && (
					<span className="block mt-1">
						{t("settings:contextWindow.unknownCapability", {
							defaultValue: "The provider did not report this model's context limit; verify it before selecting a larger budget.",
						})}
					</span>
				)}
			</div>
		</div>
	)
}
