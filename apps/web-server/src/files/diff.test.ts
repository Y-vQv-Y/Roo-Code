import { describe, expect, it } from "vitest"
import { lineDiff } from "./diff.js"

describe("lineDiff", () => {
	it("returns context, additions and removals", () => {
		expect(lineDiff("one\ntwo", "one\nthree")).toEqual([
			{ type: "context", line: 1, text: "one" },
			{ type: "remove", line: 2, text: "two" },
			{ type: "add", line: 2, text: "three" },
		])
	})
})
