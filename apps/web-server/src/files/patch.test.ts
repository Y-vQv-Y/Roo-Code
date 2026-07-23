import { describe, expect, it } from "vitest"
import { applyPatchToFiles, PatchFormatError } from "./patch.js"

describe("structured patch", () => {
	it("adds, updates and deletes files", () => {
		const patch = "*** Begin Patch\n*** Add File: new.txt\n+hello\n*** Update File: old.txt\n@@\n-old\n+new\n*** Delete File: gone.txt\n*** End Patch"
		const result = applyPatchToFiles(patch, { "old.txt": "old", "gone.txt": "bye" })
		expect(result.contents).toEqual({ "old.txt": "new", "new.txt": "hello" })
		expect(result.changes).toHaveLength(3)
	})

	it("supports move and rejects mismatched context", () => {
		const patch = "*** Begin Patch\n*** Update File: old.txt\n*** Move to: new.txt\n@@\n-old\n+new\n*** End Patch"
		expect(applyPatchToFiles(patch, { "old.txt": "old" }).contents).toEqual({ "new.txt": "new" })
		expect(() => applyPatchToFiles(patch, { "old.txt": "different" })).toThrow(PatchFormatError)
	})
})
