interface Env {
  ASSETS: Fetcher;
}

const CANONICAL_ORIGIN = "https://nozabihahalal.com";
const CANONICAL_HOST = "nozabihahalal.com";
const NOT_FOUND_PATHS = new Set(["/404", "/404/", "/404.html"]);

const LINK_HEADER = [
  `<${CANONICAL_ORIGIN}/>; rel="canonical"`,
  `</llms.txt>; rel="describedby"; type="text/markdown"; title="LLM site index"`,
  `</index.md>; rel="alternate"; type="text/markdown"; title="Markdown version of this page"`,
  `</sitemap-index.xml>; rel="sitemap"; type="application/xml"`,
  `</.well-known/security.txt>; rel="security"; type="text/plain"`,
].join(", ");

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; upgrade-insecure-requests",
};

function quality(accept: string, type: string): number {
  let best = 0;
  for (const part of accept.split(",")) {
    const [rawType, ...params] = part.trim().toLowerCase().split(";");
    if (rawType.trim() !== type) continue;
    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (Number.isFinite(q)) best = Math.max(best, q);
  }
  return best;
}

function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const markdown = quality(accept, "text/markdown");
  const html = Math.max(quality(accept, "text/html"), quality(accept, "application/xhtml+xml"));
  return markdown > 0 && markdown >= html;
}

function withVaryAccept(headers: Headers): void {
  const vary = headers.get("Vary");
  if (!vary) headers.set("Vary", "Accept");
  else if (!vary.toLowerCase().split(",").some((part) => part.trim() === "accept")) {
    headers.set("Vary", `${vary}, Accept`);
  }
}

function applySecurity(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
}

function isHome(pathname: string): boolean {
  return pathname === "/" || pathname === "/index.html";
}

function decorate(response: Response, request: Request): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  applySecurity(headers);
  if (url.pathname === "/index.md") {
    headers.set("Content-Type", "text/markdown; charset=utf-8");
    headers.set("X-Robots-Tag", "noindex");
  }
  if (url.pathname === "/llms.txt") {
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("X-Robots-Tag", "noindex");
  }
  if (url.pathname === "/.well-known/security.txt") {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }
  const type = headers.get("content-type") ?? "";
  if (response.status === 200 && isHome(url.pathname) && type.includes("text/html")) {
    headers.set("Link", LINK_HEADER);
    withVaryAccept(headers);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getCanonicalRedirect(request: Request): string | null {
  const url = new URL(request.url);
  const canonical = new URL(url.pathname + url.search, CANONICAL_ORIGIN);
  let needsRedirect = false;

  if (url.hostname === CANONICAL_HOST || url.hostname === `www.${CANONICAL_HOST}`) {
    if (url.protocol === "http:" || url.hostname === `www.${CANONICAL_HOST}`) {
      needsRedirect = true;
    }
  }

  if (canonical.pathname === "/index.html" || canonical.pathname === "/index.html/") {
    canonical.pathname = "/";
    needsRedirect = true;
  }

  if (
    !NOT_FOUND_PATHS.has(canonical.pathname) &&
    canonical.pathname !== "/" &&
    !canonical.pathname.endsWith("/") &&
    !/\.\w+$/.test(canonical.pathname)
  ) {
    canonical.pathname += "/";
    needsRedirect = true;
  }

  return needsRedirect ? canonical.toString() : null;
}

async function notFoundResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(new URL("/404.html", url.origin), request));
  return new Response(assetResponse.body, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (NOT_FOUND_PATHS.has(url.pathname)) return notFoundResponse(request, env);
    const redirectUrl = getCanonicalRedirect(request);
    if (redirectUrl) return Response.redirect(redirectUrl, 301);

    const method = request.method;
    if (
      isHome(url.pathname) &&
      (method === "GET" || method === "HEAD") &&
      wantsMarkdown(request.headers.get("Accept"))
    ) {
      const markdown = await env.ASSETS.fetch(new Request(new URL("/index.md", url.origin), { method: "GET" }));
      if (markdown.ok && markdown.body) {
        const headers = new Headers(markdown.headers);
        headers.set("Content-Type", "text/markdown; charset=utf-8");
        headers.set("X-Robots-Tag", "noindex");
        headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        headers.set("Link", LINK_HEADER);
        withVaryAccept(headers);
        applySecurity(headers);
        return new Response(method === "HEAD" ? null : markdown.body, { status: 200, headers });
      }
    }

    return decorate(await env.ASSETS.fetch(request), request);
  },
} satisfies ExportedHandler<Env>;
