import React from "react"
import { Code2 } from "lucide-react"

export default function KangarooIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<Code2
			width="20"
			height="20"
			style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "4px" }}
			{...props}
		/>
	)
}
