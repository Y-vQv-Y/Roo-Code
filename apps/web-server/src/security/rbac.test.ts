import { describe, expect, it } from "vitest"
import type { Role, User, UserGroup } from "../domain.js"
import { assertPermission, hasPermission } from "./rbac.js"

const user: User = { id: "u1", email: "a@example.com", displayName: "A", organizationIds: ["org1"], groupIds: ["g1"], roleIds: [], createdAt: "now" }
const roles: Role[] = [{ id: "r1", organizationId: "org1", name: "Editor", permissions: [{ organizationId: "org1", workspaceId: "ws1", resource: "file", action: "write" }] }]
const groups: UserGroup[] = [{ id: "g1", organizationId: "org1", name: "Editors", memberIds: ["u1"], roleIds: ["r1"] }]

describe("RBAC", () => {
	it("resolves permissions inherited from groups and scoped to a workspace", () => {
		expect(hasPermission(user, roles, groups, "org1", "ws1", "file", "write")).toBe(true)
		expect(hasPermission(user, roles, groups, "org1", "ws2", "file", "write")).toBe(false)
	})

	it("throws on missing permission", () => {
		expect(() => assertPermission(user, roles, groups, "org1", "ws1", "file", "delete")).toThrow("Permission denied")
	})
})
