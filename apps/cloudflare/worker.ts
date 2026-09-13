import { Container, switchPort } from "@cloudflare/containers";

export class MeadowContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  envVars = {
    REDIS_URL: this.env.REDIS_URL,
    DATABASE_URL: this.env.DATABASE_URL,
    GAME_NAMESPACE: this.env.GAME_NAMESPACE,
    LEGACY_NAMESPACE: this.env.LEGACY_NAMESPACE,
    WEB_ORIGINS: this.env.WEB_ORIGINS,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      env.CANONICAL_HOST &&
      (url.hostname !== env.CANONICAL_HOST || url.protocol !== "https:")
    ) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.href, 308);
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!/^\/api\/meadow(?:-v2)?\/(session|play|health)$/.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }
    if (
      !url.pathname.endsWith("/health") &&
      request.headers.get("Origin") !== url.origin
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    // Two bounded gateways share the existing fenced Redis/Postgres authority.
    const gateway = env.MEADOW.getByName(
      `gateway-${crypto.getRandomValues(new Uint8Array(1))[0] % 2}`,
    );
    const legacy = url.pathname.startsWith("/api/meadow/");
    url.pathname = url.pathname.replace(/^\/api\/meadow(?:-v2)?/, "");
    const headers = new Headers(request.headers);
    // Always overwrite caller-supplied forwarding information at the trusted edge.
    headers.set(
      "x-meadow-client-ip",
      request.headers.get("CF-Connecting-IP") ?? "unknown",
    );
    try {
      return await gateway.fetch(
        switchPort(
          new Request(new Request(url, request), { headers }),
          legacy ? 8081 : 8080,
        ),
      );
    } catch {
      return Response.json(
        { error: "The Meadow is starting. Please try again shortly." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
