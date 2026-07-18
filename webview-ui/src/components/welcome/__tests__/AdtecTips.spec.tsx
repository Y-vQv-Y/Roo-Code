import { fireEvent, render, screen } from "@/utils/test-utils"

import AdtecTips from "../AdtecTips"
import { vscode } from "@src/utils/vscode"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key, // Simple mock that returns the key
	}),
}))

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

describe("AdtecTips Component", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		render(<AdtecTips />)
	})

	test("renders internal feature buttons without external links", () => {
		expect(screen.getAllByRole("button")).toHaveLength(2)
		expect(screen.queryByRole("link")).not.toBeInTheDocument()
	})

	test("opens mode settings inside the webview", () => {
		fireEvent.click(screen.getByRole("button", { name: "adtecTips.customizableModes.title" }))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "settings",
			values: { section: "modes" },
		})
	})

	test("opens provider settings inside the webview", () => {
		fireEvent.click(screen.getByRole("button", { name: "adtecTips.modelAgnostic.title" }))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "settings",
			values: { section: "providers" },
		})
	})
})
