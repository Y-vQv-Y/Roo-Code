import { describe, expect, it } from "vitest"
import type { Organization, Role, User } from "../domain.js"
import { MemoryStore } from "../store/memory.js"
import { IdentityAdminService } from "./identity-admin.js"

describe("IdentityAdminService", () => {
	it("keeps role and group permissions inside the organization", async () => {
		const store = new MemoryStore()
		const organization: Organization = { id: "org1", name: "Example", createdAt: "now" }
		const actor: User = { id: "u1", email: "admin@example.com", displayName: "Admin", organizationIds: ["org1"], groupIds: [], roleIds: ["admin"], createdAt: "now" }
		const admin: Role = { id: "admin", organizationId: "org1", name: "Admin", permissions: [{ organizationId: "org1", resource: "*", action: "*" }] }
		await store.saveOrganization(organization)
		await store.saveUser(actor)
		await store.saveRole(admin)
		const service = new IdentityAdminService(store)
		const role = await service.createRole(actor, "org1", "Editor", [{ organizationId: "org1", workspaceId: "ws1", resource: "file", action: "write" }])
		await expect(service.createRole(actor, "org1", "Invalid", [{ organizationId: "org2", resource: "file", action: "write" }])).rejects.toThrow("same organization")
		await expect(service.createGroup(actor, "org1", "Editors", [role.id])).resolves.toMatchObject({ name: "Editors", roleIds: [role.id] })
	})
})
