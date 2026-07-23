import { randomBytes } from "node:crypto"

export interface AuthFlow {
	state: string
	providerId: string
	verifier: string
	redirectUri: string
	organizationId: string
	expiresAt: number
}

export class AuthFlowStore {
	private readonly flows = new Map<string, AuthFlow>()

	create(input: Omit<AuthFlow, "state" | "expiresAt">, ttlMs = 10 * 60 * 1000): AuthFlow {
		const flow: AuthFlow = { ...input, state: randomBytes(32).toString("base64url"), expiresAt: Date.now() + ttlMs }
		this.flows.set(flow.state, flow)
		return flow
	}

	setVerifier(state: string, verifier: string): AuthFlow {
		const flow = this.flows.get(state)
		if (!flow || flow.expiresAt <= Date.now()) throw new Error("Authentication state is invalid or expired")
		const updated = { ...flow, verifier }
		this.flows.set(state, updated)
		return updated
	}

	consume(state: string): AuthFlow | undefined {
		const flow = this.flows.get(state)
		this.flows.delete(state)
		return flow && flow.expiresAt > Date.now() ? flow : undefined
	}
}
