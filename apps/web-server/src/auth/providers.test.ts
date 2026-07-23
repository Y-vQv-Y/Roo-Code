import { afterEach, describe, expect, it, vi } from "vitest"
import { LdapIdentityProvider, OAuth2IdentityProvider, type LdapConnector } from "./providers.js"

describe("enterprise identity providers", () => {
	afterEach(() => vi.unstubAllGlobals())

	it("uses OAuth2 PKCE and maps user info claims", async () => {
		const provider = new OAuth2IdentityProvider({ id: "corp", authorizationEndpoint: "https://id.example.com/auth", tokenEndpoint: "https://id.example.com/token", userInfoEndpoint: "https://id.example.com/me", clientId: "client", scopes: ["profile", "email"] })
		const request = provider.createAuthorizationRequest("https://app.example.com/callback", "state")
		expect(new URL(request.url).searchParams.get("code_challenge_method")).toBe("S256")
		const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ sub: "user-1", email: "user@example.com", name: "User", groups: ["engineering"] }), { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)
		await expect(provider.authenticate({ code: "code", redirectUri: "https://app.example.com/callback", verifier: request.verifier })).resolves.toEqual({ subject: "user-1", email: "user@example.com", displayName: "User", groups: ["engineering"] })
	})

	it("binds the discovered LDAP DN before returning the profile", async () => {
		const connector: LdapConnector = {
			findUser: vi.fn().mockResolvedValue({ dn: "uid=user,dc=example,dc=com", attributes: { mail: "user@example.com", displayName: "User", memberOf: ["cn=developers"] } }),
			bind: vi.fn().mockResolvedValue(true),
		}
		const provider = new LdapIdentityProvider({ id: "ldap" }, connector)
		await expect(provider.authenticate({ username: "user", password: "secret" })).resolves.toMatchObject({ email: "user@example.com", groups: ["cn=developers"] })
		expect(connector.bind).toHaveBeenCalledWith("uid=user,dc=example,dc=com", "secret")
	})
})
