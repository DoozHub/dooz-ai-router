import { describe, it, expect, beforeAll } from "vitest"

// Must be set BEFORE server.ts is imported (dynamic import below): keeps
// bridge publishing disabled and CORS list empty so no network egress occurs.
process.env.BRIDGE_ENABLED = "false"
process.env.CORS_ORIGINS = ""

/**
 * Entrypoint smoke test.
 *
 * History: this file previously contained only `expect(true).toBe(true)`,
 * which masked a real regression where src/index.ts could not be imported
 * at all (phantom @doozhub/sdk-bridge dependency, audit gap G1/G2). These
 * tests lock in the actual contract: the library root imports, the Hono
 * app builds and answers deterministic, network-free requests.
 */
describe("lib-ai-router entrypoint", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let index: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any

    beforeAll(async () => {
        index = await import("./index")
        const server = await import("./server")
        app = server.app ?? server.default
        expect(app, "server.ts must export the Hono app").toBeTruthy()
    })

    it("exports the documented library surface", () => {
        expect(typeof index.createRouter).toBe("function")
        expect(typeof index.LlmRouter).toBe("function")
    })

    it("GET /openapi.json serves the API spec", async () => {
        const res = await app.request("/openapi.json")
        expect(res.status).toBe(200)
        const spec = await res.json()
        expect(spec.openapi).toMatch(/^3\./)
        expect(spec.paths && spec.paths["/complete"]).toBeTruthy()
    })

    it("POST /complete fails closed with an error envelope when unconfigured", async () => {
        // With no API keys set, the request must not succeed silently nor crash
        // the process: it returns >=400 and a parseable JSON error payload.
        const res = await app.request("/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
        })
        expect(res.status).toBeGreaterThanOrEqual(400)
        const body = await res.json()
        expect(body).toBeTruthy()
    })

    it("GET /providers/:type/status rejects an unknown provider with 400", async () => {
        const res = await app.request("/providers/bogus/status")
        expect(res.status).toBe(400)
    })

    it("GET /health reports 503 while no providers are configured", async () => {
        // Offline test env has no API keys: /health must honestly report the
        // unconfigured state rather than faking readiness.
        const res = await app.request("/health")
        expect(res.status).toBe(503)
    })
})
