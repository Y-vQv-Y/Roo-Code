import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { About } from "../About"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
	VSCodeCheckbox: () => null,
}))

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("@/i18n/TranslationContext", () => {
	const actual = vi.importActual("@/i18n/TranslationContext")
	return {
		...actual,
		useAppTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@roo/package", () => ({
	Package: {
		version: "1.0.0",
		sha: "abc12345",
	},
}))

describe("About", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the About section header", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:sections.about")).toBeInTheDocument()
	})

	it("displays version information", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText(/Version: 1\.0\.0/)).toBeInTheDocument()
	})

	it("renders the ADTEC repository link", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)

		expect(screen.getByText("ADTEC")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "ADTEC Code repository" })).toHaveAttribute(
			"href",
			"https://github.com/Y-vQv-Y",
		)
	})

	it("does not render retired Roo support links", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)

		expect(screen.queryByText("settings:about.bugReport.label")).not.toBeInTheDocument()
		expect(screen.queryByText("settings:about.securityIssue.label")).not.toBeInTheDocument()
	})

	it("does not render feature request copy", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)

		expect(screen.queryByText("settings:about.featureRequest.label")).not.toBeInTheDocument()
	})

	it("renders export, import, and reset buttons", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:footer.settings.export")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.import")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.reset")).toBeInTheDocument()
	})
})
