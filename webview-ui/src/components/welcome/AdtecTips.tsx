import { useTranslation } from "react-i18next"
import { ReplaceAll, Users } from "lucide-react"

import { vscode } from "@src/utils/vscode"

const tips = [
	{
		icon: <Users className="size-4 shrink-0 mt-0.5" />,
		section: "modes",
		titleKey: "adtecTips.customizableModes.title",
		descriptionKey: "adtecTips.customizableModes.description",
	},
	{
		icon: <ReplaceAll className="size-4 shrink-0 mt-0.5" />,
		section: "providers",
		titleKey: "adtecTips.modelAgnostic.title",
		descriptionKey: "adtecTips.modelAgnostic.description",
	},
]

const AdtecTips = () => {
	const { t } = useTranslation("chat")

	return (
		<div className="flex flex-col gap-2 mb-4 max-w-[500px] text-vscode-descriptionForeground">
			<p className="my-0 pr-2">{t("about")}</p>
			<div className="gap-4">
				{tips.map((tip) => (
					<div key={tip.titleKey} className="flex items-start gap-2 mt-2 mr-6 leading-relaxed">
						{tip.icon}
						<span>
							<button
								type="button"
								className="border-0 bg-transparent p-0 text-vscode-textLink-foreground underline cursor-pointer"
								onClick={() =>
									vscode.postMessage({
										type: "switchTab",
										tab: "settings",
										values: { section: tip.section },
									})
								}>
								{t(tip.titleKey)}
							</button>
							: {t(tip.descriptionKey)}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

export default AdtecTips
