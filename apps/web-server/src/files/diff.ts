import type { FileDiffEntry } from "../domain.js"

export function lineDiff(before: string, after: string): FileDiffEntry[] {
	const left = before === "" ? [] : before.split("\n")
	const right = after === "" ? [] : after.split("\n")
	const rows = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0))

	for (let i = left.length - 1; i >= 0; i -= 1) {
		for (let j = right.length - 1; j >= 0; j -= 1) {
			rows[i][j] = left[i] === right[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1])
		}
	}

	const result: FileDiffEntry[] = []
	let i = 0
	let j = 0
	let newLine = 1
	while (i < left.length || j < right.length) {
		if (i < left.length && j < right.length && left[i] === right[j]) {
			result.push({ type: "context", line: newLine, text: left[i] })
			i += 1
			j += 1
			newLine += 1
		} else if (j < right.length && (i === left.length || rows[i][j + 1] > rows[i + 1][j])) {
			result.push({ type: "add", line: newLine, text: right[j] })
			j += 1
			newLine += 1
		} else {
			result.push({ type: "remove", line: newLine, text: left[i] })
			i += 1
		}
	}
	return result
}
