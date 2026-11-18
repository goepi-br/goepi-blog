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
 * blog.goepi.com.br e www.goepi.com.br levam para goepi.com.br/blog.
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

export default {
	...handler,
	async fetch(request, env, ctx) {
		const target = canonicalRedirect(new URL(request.url));
		if (target) return Response.redirect(target, 301);
		return handler.fetch!(request, env, ctx);
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
