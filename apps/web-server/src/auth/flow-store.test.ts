import { describe, expect, it } from "vitest"
import { AuthFlowStore } from "./flow-store.js"

describe("AuthFlowStore", () => {
	it("consumes state once", () => {
		const store = new AuthFlowStore()
		const flow = store.create({ providerId: "oidc", verifier: "verifier", redirectUri: "https://app/callback", organizationId: "org1" }, 60_000)
		expect(store.consume(flow.state)).toMatchObject({ verifier: "verifier" })
		expect(store.consume(flow.state)).toBeUndefined()
	})
})
