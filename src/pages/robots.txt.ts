import type { APIRoute } from "astro";

const robots = `# Content Signals — https://contentsignals.org
# search=yes    index this site and show it in search results
# ai-input=yes  use pages as live context for AI answers and citations
# ai-train=no   do not train or fine-tune models on this site

# Training crawlers. Search and answer bots are allowed by the * group.
User-agent: GPTBot
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: Google-Extended
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: ClaudeBot
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: Applebot-Extended
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: CCBot
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: Bytespider
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

User-agent: meta-externalagent
Content-Signal: search=yes, ai-input=yes, ai-train=no
Disallow: /

# Everyone else, including Googlebot, Bingbot, and AI answer crawlers.
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

Sitemap: https://nozabihahalal.com/sitemap-index.xml
`;

export const GET: APIRoute = () =>
  new Response(robots, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
