import { describe, expect, it } from "vitest"
import type { IdentityProvider, Organization } from "../domain.js"
import { MemoryStore } from "../store/memory.js"
import { AuthService } from "./auth-service.js"

describe("AuthService", () => {
	it("provisions an external user once and creates expiring sessions", async () => {
		const store = new MemoryStore()
		const organization: Organization = { id: "org1", name: "Example", createdAt: new Date().toISOString() }
		await store.saveOrganization(organization)
		const provider: IdentityProvider = { id: "oidc", kind: "oidc", authenticate: async () => ({ subject: "subject", email: "user@example.com", displayName: "User" }) }
		const auth = new AuthService(store, [provider], 60_000)
		const first = await auth.authenticate("oidc", {}, organization.id)
		const second = await auth.authenticate("oidc", {}, organization.id)
		expect(second.user.id).toBe(first.user.id)
		expect(second.session.token).not.toBe(first.session.token)
		await expect(auth.authenticateToken(first.session.token)).resolves.toMatchObject({ email: "user@example.com" })
	})
})
