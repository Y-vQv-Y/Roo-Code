import { randomBytes, randomUUID } from "node:crypto"
import type { IdentityProvider, Session, User } from "../domain.js"
import type { IdentityStore } from "../store/contracts.js"
import { IdentityAdminService } from "../identity/identity-admin.js"

export class AuthService {
	private readonly providers = new Map<string, IdentityProvider>()

	constructor(private readonly store: IdentityStore, providers: readonly IdentityProvider[] = [], private readonly sessionTtlMs = 8 * 60 * 60 * 1000, private readonly providerOrganizations: Readonly<Record<string, string>> = {}) {
		for (const provider of providers) this.providers.set(provider.id, provider)
	}

	getProvider(id: string): IdentityProvider | undefined {
		return this.providers.get(id)
	}

	async authenticate(providerId: string, input: Record<string, string>, organizationId: string): Promise<{ user: User; session: Session }> {
		const provider = this.providers.get(providerId)
		if (!provider) throw new Error("Identity provider is not configured")
		if (!(await this.store.getOrganization(organizationId))) throw new Error("Organization is not configured")
		const configuredOrganization = this.providerOrganizations[providerId]
		if (configuredOrganization && configuredOrganization !== organizationId) throw new Error("Identity provider is not configured for this organization")
		const profile = await provider.authenticate(input)
		let user = await this.store.getUserByExternalSubject(providerId, profile.subject)
		if (user && !user.organizationIds.includes(organizationId)) throw new Error("User is not a member of this organization")
		if (!user) {
			user = {
				id: randomUUID(),
				email: profile.email,
				displayName: profile.displayName,
				organizationIds: [organizationId],
				groupIds: [],
				roleIds: [],
				identityProvider: providerId,
				externalSubject: profile.subject,
				createdAt: new Date().toISOString(),
			}
			await this.store.saveUser(user)
		}
		if (profile.groups) user = await new IdentityAdminService(this.store).syncExternalGroups(user, organizationId, profile.groups)
		return { user, session: await this.createSession(user.id) }
	}

	async createSession(userId: string): Promise<Session> {
		const session: Session = { token: randomBytes(32).toString("base64url"), userId, expiresAt: Date.now() + this.sessionTtlMs }
		await this.store.saveSession(session)
		return session
	}

	async authenticateToken(token: string): Promise<User | undefined> {
		const session = await this.store.getSession(token)
		return session ? this.store.getUserById(session.userId) : undefined
	}
}
