import handler, {
	createScheduledHandler,
	EmDashRoom,
	EmDashRoomSite,
	PluginBridge,
} from "@emdash-cms/cloudflare/worker";

export { EmDashRoom, EmDashRoomSite, PluginBridge };

/** Endereço oficial do blog: https://goepi.com.br/blog */
const CANONICAL_ORIGIN = "https://goepi.com.br";

/** Caminhos do EmDash e do Astro que continuam respondendo em qualquer domínio. */
const PASSTHROUGH = ["/_emdash", "/_astro", "/_image", "/_server-islands"];

/**
 * blog.goepi.com.br leva para goepi.com.br/blog e www.goepi.com.br leva para o
 * mesmo caminho em goepi.com.br (o www inteiro passa por este Worker).
 * O painel (/_emdash) continua acessível nos domínios antigos para que a
 * troca de domínio e das chaves de acesso possa ser feita com calma.
 */
function canonicalRedirect(url: URL): string | null {
	if (url.hostname !== "blog.goepi.com.br" && url.hostname !== "www.goepi.com.br") return null;
	const path = url.pathname;
	if (PASSTHROUGH.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;

	let target = path;
	if (url.hostname === "blog.goepi.com.br") {
		if (path === "/" || path === "") target = "/blog";
		else if (path.startsWith("/posts/")) target = `/blog/${path.slice("/posts/".length)}`;
		else if (path === "/posts") target = "/blog";
		else if (path === "/rss.xml") target = "/blog/rss.xml";
		else if (path === "/robots.txt" || path.startsWith("/sitemap")) target = path;
		else if (path !== "/blog" && !path.startsWith("/blog/")) target = `/blog${path}`;
	}
	return `${CANONICAL_ORIGIN}${target}${url.search}`;
}

/**
 * Páginas do site institucional (projeto Pages goepi-br/website). O sitemap do
 * EmDash só conhece os posts; este sitemap extra entra no índice para o Google
 * achar também a Home, a Nossa história e a lista do blog.
 */
const SITE_PAGES = [
	{ path: "/", priority: "1.0", changefreq: "monthly" },
	{ path: "/about", priority: "0.8", changefreq: "yearly" },
	{ path: "/blog", priority: "0.8", changefreq: "weekly" },
];
const SITE_PAGES_LASTMOD = "2026-11-23";

function siteSitemap(): Response {
	const urls = SITE_PAGES.map(
		(p) =>
			`  <url>\n    <loc>${CANONICAL_ORIGIN}${p.path}</loc>\n    <lastmod>${SITE_PAGES_LASTMOD}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
	).join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(xml, {
		headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
	});
}

/** Acrescenta o sitemap das páginas do site ao índice gerado pelo EmDash. */
async function withSitePages(response: Response): Promise<Response> {
	if (!response.ok) return response;
	const xml = await response.text();
	const entry = `  <sitemap>\n    <loc>${CANONICAL_ORIGIN}/sitemap-site.xml</loc>\n    <lastmod>${SITE_PAGES_LASTMOD}</lastmod>\n  </sitemap>\n`;
	const patched = xml.includes("/sitemap-site.xml") ? xml : xml.replace("</sitemapindex>", `${entry}</sitemapindex>`);
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	return new Response(patched, { status: response.status, headers });
}

/** Linha do robots.txt que aponta o resumo para assistentes de IA (/llms.txt do site). */
const LLMS_TXT_LINE = `# Resumo para assistentes de IA: ${CANONICAL_ORIGIN}/llms.txt`;

/**
 * Acrescenta a linha do llms.txt ao robots.txt gerado pelo EmDash (padrão ou
 * o personalizado no painel), logo antes da linha Sitemap.
 */
async function withLlmsTxt(response: Response): Promise<Response> {
	if (!response.ok) return response;
	const text = await response.text();
	let patched = text;
	if (!text.includes(LLMS_TXT_LINE)) {
		const lines = text.split("\n");
		const sitemapAt = lines.findIndex((line) => /^sitemap:/i.test(line.trim()));
		if (sitemapAt >= 0) lines.splice(sitemapAt, 0, LLMS_TXT_LINE);
		else lines.push(LLMS_TXT_LINE, "");
		patched = lines.join("\n");
	}
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	return new Response(patched, { status: response.status, headers });
}

export default {
	...handler,
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const target = canonicalRedirect(url);
		if (target) return Response.redirect(target, 301);
		if (url.pathname === "/sitemap-site.xml") return siteSitemap();
		const response = await handler.fetch!(request, env, ctx);
		if (url.pathname === "/sitemap.xml") return withSitePages(response);
		if (url.pathname === "/robots.txt") return withLlmsTxt(response);
		return response;
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
