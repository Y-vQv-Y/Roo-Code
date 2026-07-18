// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "adtec-code",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "ADTEC",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "adtec-code-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/adtec-logo.png",
							},
						],
					},
					views: {
						"adtec-code-ActivityBar": [
							{
								type: "webview",
								id: "adtec-code.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "adtec-code.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(edit)",
						},
						{
							command: "adtec-code.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "adtec-code.contextMenu",
								group: "navigation",
							},
						],
						"adtec-code.contextMenu": [
							{
								command: "adtec-code.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "adtec-code.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == adtec-code.TabPanelProvider",
							},
							{
								command: "adtec-code.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == adtec-code.TabPanelProvider",
							},
							{
								command: "adtec-code.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == adtec-code.TabPanelProvider",
							},
						],
					},
					submenus: [
						{
							id: "adtec-code.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "adtec-code.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"adtec-code.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"adtec-code.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "adtec-code-nightly",
				displayName: "ADTEC Code Nightly",
				publisher: "ADTEC",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["adtec-code", "adtec-code-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "adtec-code-nightly",
			displayName: "ADTEC Code Nightly",
			description: "%extension.description%",
			publisher: "ADTEC",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "adtec-code-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/adtec-logo.png",
						},
					],
				},
				views: {
					"adtec-code-nightly-ActivityBar": [
						{
							type: "webview",
							id: "adtec-code-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "adtec-code-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(edit)",
					},
					{
						command: "adtec-code-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "adtec-code-nightly.contextMenu",
							group: "navigation",
						},
					],
					"adtec-code-nightly.contextMenu": [
						{
							command: "adtec-code-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "adtec-code-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == adtec-code-nightly.TabPanelProvider",
						},
						{
							command: "adtec-code-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == adtec-code-nightly.TabPanelProvider",
						},
						{
							command: "adtec-code-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == adtec-code-nightly.TabPanelProvider",
						},
					],
				},
				submenus: [
					{
						id: "adtec-code-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "adtec-code-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"adtec-code-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"adtec-code-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
