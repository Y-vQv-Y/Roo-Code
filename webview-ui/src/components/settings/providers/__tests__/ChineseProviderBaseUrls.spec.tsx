import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import {
	deepSeekDefaultBaseUrl,
	minimaxDefaultBaseUrl,
	moonshotDefaultBaseUrl,
	type ProviderSettings,
	zaiApiLineConfigs,
	zaiDefaultApiLine,
} from "@roo-code/types"

import { DeepSeek } from "../DeepSeek"
import { MiniMax } from "../MiniMax"
import { Moonshot } from "../Moonshot"
import { ZAi } from "../ZAi"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, placeholder, type }: any) => (
		<label>
			{children}
			<input type={type ?? "text"} value={value} placeholder={placeholder} onChange={onInput} />
		</label>
	),
	VSCodeDropdown: ({ children, value, onChange }: any) => (
		<select value={value} onChange={onChange}>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: any) => <option value={value}>{children}</option>,
}))

vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children }: any) => <a>{children}</a>,
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

describe("Chinese provider base URLs", () => {
	const setApiConfigurationField = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it.each([
		["DeepSeek", DeepSeek, "deepSeekBaseUrl", deepSeekDefaultBaseUrl],
		["Moonshot", Moonshot, "moonshotBaseUrl", moonshotDefaultBaseUrl],
		["MiniMax", MiniMax, "minimaxBaseUrl", minimaxDefaultBaseUrl],
	] as const)("uses the China endpoint by default and accepts a custom URL for %s", (_name, Component, field, defaultUrl) => {
		render(
			<Component
				apiConfiguration={{ apiProvider: "deepseek" } as ProviderSettings}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		const baseUrlInput = screen.getByDisplayValue(defaultUrl)
		fireEvent.change(baseUrlInput, { target: { value: "https://relay.example.com/v1" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith(field, "https://relay.example.com/v1")
	})

	it("uses the China coding endpoint as the Z.AI placeholder and accepts a custom URL", () => {
		render(
			<ZAi
				apiConfiguration={{ apiProvider: "zai" } as ProviderSettings}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		const baseUrlInput = screen.getByPlaceholderText(zaiApiLineConfigs[zaiDefaultApiLine].baseUrl)
		fireEvent.change(baseUrlInput, { target: { value: "https://relay.example.com/v1" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith("zaiBaseUrl", "https://relay.example.com/v1")
	})
})
