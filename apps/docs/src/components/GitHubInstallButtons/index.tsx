import React from "react"
import { RxGithubLogo } from "react-icons/rx"
import { VscVscode } from "react-icons/vsc"
import { GITHUB_MAIN_REPO_URL } from "@site/src/constants"
import styles from "./styles.module.css"

export default function GitHubInstallButtons(): React.JSX.Element {
	return (
		<div className={styles.container}>
			{/* GitHub Button */}
			<a
				href={GITHUB_MAIN_REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.githubButton}
				title="GitHub Repository">
				<RxGithubLogo className={styles.icon} />
				<span>Source</span>
			</a>

			{/* Install Button */}
			<a
				href={GITHUB_MAIN_REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.installButton}
				title="ADTEC Code internal distribution">
				<VscVscode className={styles.icon} />
				<span>
					Internal distribution
				</span>
			</a>
		</div>
	)
}
