import React from "react"
import { Package } from "@roo/package"

interface VersionIndicatorProps {
	className?: string
}

const VersionIndicator: React.FC<VersionIndicatorProps> = ({ className = "" }) => {
	return (
		<span
			className={`text-xs text-vscode-descriptionForeground px-2 py-1 ${className}`}
			aria-label={`ADTEC Code version ${Package.version}`}>
			v{Package.version}
		</span>
	)
}

export default VersionIndicator
