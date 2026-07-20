import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { minimaxDefaultBaseUrl, minimaxInternationalBaseUrl, type ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type MiniMaxProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const MiniMax = ({ apiConfiguration, setApiConfigurationField }: MiniMaxProps) => {
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
				value={apiConfiguration.minimaxBaseUrl || minimaxDefaultBaseUrl}
				type="url"
				onInput={handleInputChange("minimaxBaseUrl")}
				placeholder={t("settings:placeholders.baseUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.minimaxBaseUrl")}</label>
			</VSCodeTextField>
			<div>
				<VSCodeTextField
					value={apiConfiguration?.minimaxApiKey || ""}
					type="password"
					onInput={handleInputChange("minimaxApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.minimaxApiKey")}</label>
				</VSCodeTextField>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.apiKeyStorageNotice")}
				</div>
				{!apiConfiguration?.minimaxApiKey && (
					<VSCodeButtonLink
						href={
							(apiConfiguration.minimaxBaseUrl || minimaxDefaultBaseUrl) === minimaxInternationalBaseUrl
								? "https://www.minimax.io/platform/user-center/basic-information/interface-key"
								: "https://platform.minimaxi.com/user-center/basic-information/interface-key"
						}
						appearance="secondary">
						{t("settings:providers.getMiniMaxApiKey")}
					</VSCodeButtonLink>
				)}
			</div>
		</>
	)
}
