import { describe, expect, it, vi } from "vitest"
import type { SqlClient } from "./mysql.js"
import { MySqlStore } from "./mysql.js"

describe("MySqlStore", () => {
	it("uses parameterized queries for external identities", async () => {
		const query = vi.fn().mockResolvedValue([{ id: "u1", email: "user@example.com", display_name: "User", organization_ids: '["org1"]', group_ids: "[]", role_ids: "[]", identity_provider: "oidc", external_subject: "subject", created_at: new Date("2026-01-01T00:00:00Z") }])
		const store = new MySqlStore({ query } as SqlClient)
		await expect(store.getUserByExternalSubject("oidc", "subject' OR 1=1")).resolves.toMatchObject({ id: "u1", organizationIds: ["org1"] })
		expect(query).toHaveBeenCalledWith(expect.stringContaining("identity_provider = ?"), ["oidc", "subject' OR 1=1"])
	})
})
