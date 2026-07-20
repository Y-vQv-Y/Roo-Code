import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { moonshotDefaultBaseUrl, moonshotInternationalBaseUrl, type ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type MoonshotProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Moonshot = ({ apiConfiguration, setApiConfigurationField }: MoonshotProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration.moonshotBaseUrl || moonshotDefaultBaseUrl}
				type="url"
				onInput={handleInputChange("moonshotBaseUrl")}
				placeholder={t("settings:placeholders.baseUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.moonshotBaseUrl")}</label>
			</VSCodeTextField>
			<div>
				<VSCodeTextField
					value={apiConfiguration?.moonshotApiKey || ""}
					type="password"
					onInput={handleInputChange("moonshotApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.moonshotApiKey")}</label>
				</VSCodeTextField>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.apiKeyStorageNotice")}
				</div>
				{!apiConfiguration?.moonshotApiKey && (
					<VSCodeButtonLink
						href={
							(apiConfiguration.moonshotBaseUrl || moonshotDefaultBaseUrl) === moonshotInternationalBaseUrl
								? "https://platform.kimi.ai/console/api-keys"
								: "https://platform.moonshot.cn/console/api-keys"
						}
						appearance="secondary">
						{t("settings:providers.getMoonshotApiKey")}
					</VSCodeButtonLink>
				)}
			</div>
		</>
	)
}
