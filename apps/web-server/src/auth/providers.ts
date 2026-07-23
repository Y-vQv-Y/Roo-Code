import { createHash, randomBytes } from "node:crypto"
import type { IdentityProfile, IdentityProvider } from "../domain.js"

interface OAuthTokenResponse {
	access_token?: string
	token_type?: string
}

export interface OAuth2ProviderConfig {
	id: string
	authorizationEndpoint: string
	tokenEndpoint: string
	userInfoEndpoint: string
	clientId: string
	clientSecret?: string
	scopes: string[]
	emailClaim?: string
	nameClaim?: string
	subjectClaim?: string
	groupsClaim?: string
}

function base64Url(buffer: Buffer): string {
	return buffer.toString("base64url")
}

function getStringClaim(payload: Record<string, unknown>, name: string): string {
	const value = payload[name]
	if (typeof value !== "string" || value.trim() === "") throw new Error(`Identity provider did not return ${name}`)
	return value
}

export class OAuth2IdentityProvider implements IdentityProvider {
	readonly kind = "oauth2" as const
	readonly id: string

	constructor(protected readonly config: OAuth2ProviderConfig) {
		this.id = config.id
	}

	createAuthorizationRequest(redirectUri: string, state: string): { url: string; verifier: string } {
		const verifier = base64Url(randomBytes(48))
		const challenge = base64Url(createHash("sha256").update(verifier).digest())
		const url = new URL(this.config.authorizationEndpoint)
		url.searchParams.set("response_type", "code")
		url.searchParams.set("client_id", this.config.clientId)
		url.searchParams.set("redirect_uri", redirectUri)
		url.searchParams.set("scope", this.config.scopes.join(" "))
		url.searchParams.set("state", state)
		url.searchParams.set("code_challenge", challenge)
		url.searchParams.set("code_challenge_method", "S256")
		return { url: url.toString(), verifier }
	}

	async authenticate(input: Record<string, string>): Promise<IdentityProfile> {
		const body = new URLSearchParams({
			grant_type: "authorization_code",
			code: input.code ?? "",
			redirect_uri: input.redirectUri ?? "",
			client_id: this.config.clientId,
			code_verifier: input.verifier ?? "",
		})
		if (this.config.clientSecret) body.set("client_secret", this.config.clientSecret)
		const tokenResponse = await fetch(this.config.tokenEndpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
			body,
		})
		if (!tokenResponse.ok) throw new Error(`OAuth2 token exchange failed with status ${tokenResponse.status}`)
		const token = (await tokenResponse.json()) as OAuthTokenResponse
		if (!token.access_token) throw new Error("OAuth2 token response did not contain an access token")
		const userInfoResponse = await fetch(this.config.userInfoEndpoint, {
			headers: { authorization: `${token.token_type ?? "Bearer"} ${token.access_token}`, accept: "application/json" },
		})
		if (!userInfoResponse.ok) throw new Error(`OAuth2 user info failed with status ${userInfoResponse.status}`)
		const userInfo = (await userInfoResponse.json()) as Record<string, unknown>
		const groupsClaim = this.config.groupsClaim ?? "groups"
		const groups = Array.isArray(userInfo[groupsClaim]) ? userInfo[groupsClaim].filter((group): group is string => typeof group === "string") : undefined
		return {
			subject: getStringClaim(userInfo, this.config.subjectClaim ?? "sub"),
			email: getStringClaim(userInfo, this.config.emailClaim ?? "email"),
			displayName: getStringClaim(userInfo, this.config.nameClaim ?? "name"),
			groups,
		}
	}
}

interface OidcDiscovery {
	authorization_endpoint: string
	token_endpoint: string
	userinfo_endpoint: string
}

export interface OidcProviderConfig extends Omit<OAuth2ProviderConfig, "authorizationEndpoint" | "tokenEndpoint" | "userInfoEndpoint"> {
	issuer: string
}

export class OidcIdentityProvider implements IdentityProvider {
	readonly kind = "oidc" as const
	readonly id: string
	private delegate?: OAuth2IdentityProvider

	constructor(private readonly oidcConfig: OidcProviderConfig) {
		this.id = oidcConfig.id
	}

	private async provider(): Promise<OAuth2IdentityProvider> {
		if (this.delegate) return this.delegate
		const issuer = this.oidcConfig.issuer.replace(/\/$/, "")
		const response = await fetch(`${issuer}/.well-known/openid-configuration`, { headers: { accept: "application/json" } })
		if (!response.ok) throw new Error(`OIDC discovery failed with status ${response.status}`)
		const discovery = (await response.json()) as OidcDiscovery
		if (!discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.userinfo_endpoint) throw new Error("OIDC discovery document is incomplete")
		this.delegate = new OAuth2IdentityProvider({ ...this.oidcConfig, authorizationEndpoint: discovery.authorization_endpoint, tokenEndpoint: discovery.token_endpoint, userInfoEndpoint: discovery.userinfo_endpoint, scopes: [...new Set(["openid", ...this.oidcConfig.scopes])] })
		return this.delegate
	}

	async createAuthorizationRequest(redirectUri: string, state: string): Promise<{ url: string; verifier: string }> {
		return (await this.provider()).createAuthorizationRequest(redirectUri, state)
	}

	async authenticate(input: Record<string, string>): Promise<IdentityProfile> {
		return (await this.provider()).authenticate(input)
	}
}

export interface LdapDirectoryEntry {
	dn: string
	attributes: Record<string, string | string[] | undefined>
}

export interface LdapConnector {
	findUser(username: string): Promise<LdapDirectoryEntry | undefined>
	bind(dn: string, password: string): Promise<boolean>
}

export interface LdapProviderConfig {
	id: string
	emailAttribute?: string
	nameAttribute?: string
	groupAttribute?: string
}

export class LdapIdentityProvider implements IdentityProvider {
	readonly kind = "ldap" as const
	readonly id: string

	constructor(private readonly config: LdapProviderConfig, private readonly connector: LdapConnector) {
		this.id = config.id
	}

	async authenticate(input: Record<string, string>): Promise<IdentityProfile> {
		const entry = await this.connector.findUser(input.username ?? "")
		if (!entry || !(await this.connector.bind(entry.dn, input.password ?? ""))) throw new Error("LDAP authentication failed")
		const stringValue = (name: string): string => {
			const value = entry.attributes[name]
			const result = Array.isArray(value) ? value[0] : value
			if (!result) throw new Error(`LDAP entry is missing ${name}`)
			return result
		}
		const groupValue = entry.attributes[this.config.groupAttribute ?? "memberOf"]
		return {
			subject: entry.dn,
			email: stringValue(this.config.emailAttribute ?? "mail"),
			displayName: stringValue(this.config.nameAttribute ?? "displayName"),
			groups: groupValue ? (Array.isArray(groupValue) ? groupValue : [groupValue]) : undefined,
		}
	}
}
