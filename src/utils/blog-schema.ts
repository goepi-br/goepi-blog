/**
 * Dados estruturados (JSON-LD) do Blog GoEPI.
 *
 * Toda página do blog leva o Organization e o WebSite completos, iguais aos
 * de src/index.html no repositório goepi-br/website e com os mesmos @id,
 * para o Google ligar as entidades. A home do blog acrescenta o nó Blog e a
 * página de artigo acrescenta BlogPosting, BreadcrumbList e, quando o artigo
 * tem a seção "Perguntas frequentes", FAQPage com as mesmas perguntas e
 * respostas que aparecem na página.
 */
import { SITE_URL } from "./goepi";
import { normalize } from "./blog-cta";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const BLOG_ID = `${SITE_URL}/blog#blog`;
export const AUTHOR = {
	"@type": "Person",
	"@id": `${SITE_URL}/about#paulo-abdalla`,
	name: "Paulo Abdalla",
	url: "https://www.linkedin.com/in/pauloabdalla-gestaodeepis-goepi/",
};

/** Cópia do nó Organization de src/index.html (goepi-br/website). Manter os dois iguais. */
export const ORGANIZATION = {
	"@type": "Organization",
	"@id": ORGANIZATION_ID,
	name: "GoEPI",
	legalName: "GOEPI TECNOLOGIA LTDA",
	taxID: "66.586.904/0001-59",
	identifier: { "@type": "PropertyValue", propertyID: "CNPJ", value: "66.586.904/0001-59" },
	url: `${SITE_URL}/`,
	logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
	description:
		"Software de gestão de EPIs criado em 2026, que nasceu no ecossistema Kensys Group, que apoia a GoEPI. Registra cada entrega de EPI com reconhecimento facial, biometria ou assinatura digital, inclusive offline, controla estoque e validade de CA e gera relatórios para auditorias da NR-6.",
	foundingDate: "2026",
	address: {
		"@type": "PostalAddress",
		addressLocality: "São José dos Campos",
		addressRegion: "SP",
		addressCountry: "BR",
	},
	email: "contato@goepi.com.br",
	telephone: "+55-12-99738-4873",
	areaServed: { "@type": "Country", name: "Brasil" },
	contactPoint: {
		"@type": "ContactPoint",
		contactType: "sales",
		email: "contato@goepi.com.br",
		telephone: "+55-12-99738-4873",
		availableLanguage: "Portuguese",
		areaServed: "BR",
	},
	founder: {
		...AUTHOR,
		jobTitle: "Fundador e Diretor Comercial",
		email: "paulo.abdalla@goepi.com.br",
		worksFor: { "@id": ORGANIZATION_ID },
		sameAs: ["https://www.linkedin.com/in/pauloabdalla-gestaodeepis-goepi/"],
	},
	sameAs: [
		"https://www.linkedin.com/company/goepi/",
		"https://www.instagram.com/go.epi/",
		"https://maps.google.com/maps?cid=5493879531777858719",
	],
};

/** Cópia do nó WebSite de src/index.html (goepi-br/website). */
export const WEBSITE = {
	"@type": "WebSite",
	"@id": WEBSITE_ID,
	url: `${SITE_URL}/`,
	name: "GoEPI",
	inLanguage: "pt-BR",
	publisher: { "@id": ORGANIZATION_ID },
};

/** Nó Blog da home do blog (o mesmo @id que BlogPosting.isPartOf usa). */
export function buildBlogJsonLd(description?: string | null): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Blog",
				"@id": BLOG_ID,
				name: "Blog GoEPI",
				url: `${SITE_URL}/blog`,
				...(description ? { description } : {}),
				inLanguage: "pt-BR",
				isPartOf: { "@id": WEBSITE_ID },
				publisher: { "@id": ORGANIZATION_ID },
			},
		],
	};
}

/** Grafo final da página: Organization e WebSite primeiro, depois os nós da página. */
export function withSiteGraph(jsonLd?: Record<string, unknown> | null): Record<string, unknown> {
	const graph = jsonLd?.["@graph"];
	const nodes = Array.isArray(graph) ? graph : jsonLd ? [jsonLd] : [];
	return {
		"@context": "https://schema.org",
		"@graph": [
			ORGANIZATION,
			WEBSITE,
			...nodes.map((n) => {
				const { "@context": _ctx, ...rest } = n as Record<string, unknown>;
				return rest;
			}),
		],
	};
}

const DEFAULT_IMAGE = `${SITE_URL}/assets/og/goepi-og.jpg`;
const INTERNAL_MEDIA_PREFIX = "/_emdash/api/media/file/";

type Span = { text?: string };
type Block = {
	_type?: string;
	style?: string;
	listItem?: string;
	children?: Span[];
	asset?: Record<string, unknown>;
	[k: string]: unknown;
};

const blockText = (b: Block) =>
	(b.children ?? [])
		.map((c) => c.text ?? "")
		.join("")
		.replace(/\s+/g, " ")
		.trim();
const isText = (b: Block) => b?._type === "block";

/** URL absoluta (no domínio do site) para um caminho ou URL. */
export function absoluteUrl(src: string): string {
	if (/^https?:\/\//i.test(src)) return src;
	return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** URL da primeira imagem do corpo do artigo (bloco `image` do Portable Text). */
export function firstBodyImage(value: unknown): string | null {
	const blocks: Block[] = Array.isArray(value) ? (value as Block[]) : [];
	for (const b of blocks) {
		if (b?._type !== "image" || !b.asset || typeof b.asset !== "object") continue;
		const asset = b.asset as Record<string, unknown>;
		const meta = (asset.meta ?? {}) as Record<string, unknown>;
		const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
		const url =
			str(asset.url) ??
			str(asset.src) ??
			(str(meta.storageKey) ? `${INTERNAL_MEDIA_PREFIX}${meta.storageKey}` : undefined) ??
			(str(asset._ref) ? `${INTERNAL_MEDIA_PREFIX}${asset._ref}` : undefined);
		if (url) return absoluteUrl(url);
	}
	return null;
}

/**
 * Perguntas e respostas da seção "Perguntas frequentes": cada H3 terminado em
 * "?" é uma pergunta, e o texto até o próximo H3 ou H2 é a resposta (texto
 * puro). Sem a H2 "Perguntas frequentes…", devolve lista vazia.
 */
export function extractFaq(value: unknown): Array<{ question: string; answer: string }> {
	const blocks: Block[] = Array.isArray(value) ? (value as Block[]) : [];
	const start = blocks.findIndex(
		(b) => isText(b) && b.style === "h2" && normalize(blockText(b)).startsWith("perguntas frequentes"),
	);
	if (start < 0) return [];

	const faq: Array<{ question: string; answer: string }> = [];
	let current: { question: string; parts: string[] } | null = null;
	const flush = () => {
		if (current) {
			const answer = current.parts.join(" ").replace(/\s+/g, " ").trim();
			if (answer) faq.push({ question: current.question, answer });
		}
		current = null;
	};

	for (let i = start + 1; i < blocks.length; i++) {
		const b = blocks[i];
		if (isText(b) && b.style === "h2") break;
		if (isText(b) && b.style === "h3") {
			flush();
			const q = blockText(b);
			if (q.endsWith("?")) current = { question: q, parts: [] };
			continue;
		}
		if (current && isText(b) && !/^h[1-6]$/.test(b.style ?? "")) {
			const t = blockText(b);
			if (t) current.parts.push(t);
		}
	}
	flush();
	return faq;
}

export interface PostSchemaInput {
	url: string;
	title: string;
	description?: string | null;
	content: unknown;
	coverImage?: string | null;
	publishedAt?: Date | null;
	updatedAt?: Date | null;
}

/** Grafo JSON-LD do artigo: BlogPosting, BreadcrumbList e FAQPage (se houver). */
export function buildPostJsonLd(input: PostSchemaInput): Record<string, unknown> {
	const { url, title, description, content, coverImage, publishedAt, updatedAt } = input;
	const image = firstBodyImage(content) ?? (coverImage ? absoluteUrl(coverImage) : DEFAULT_IMAGE);
	const published = publishedAt?.toISOString();
	const modified = (updatedAt ?? publishedAt)?.toISOString();

	const graph: Record<string, unknown>[] = [
		{
			"@type": "BlogPosting",
			"@id": `${url}#article`,
			headline: title,
			...(description ? { description } : {}),
			image: [image],
			url,
			...(published ? { datePublished: published } : {}),
			...(modified ? { dateModified: modified } : {}),
			inLanguage: "pt-BR",
			author: AUTHOR,
			publisher: { "@id": ORGANIZATION_ID },
			mainEntityOfPage: { "@type": "WebPage", "@id": url },
			isPartOf: { "@type": "Blog", "@id": BLOG_ID, name: "Blog GoEPI", url: `${SITE_URL}/blog` },
		},
		{
			"@type": "BreadcrumbList",
			"@id": `${url}#breadcrumb`,
			itemListElement: [
				{ "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
				{ "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
				{ "@type": "ListItem", position: 3, name: title, item: url },
			],
		},
	];

	const faq = extractFaq(content);
	if (faq.length > 0) {
		graph.push({
			"@type": "FAQPage",
			"@id": `${url}#faq`,
			mainEntity: faq.map((f) => ({
				"@type": "Question",
				name: f.question,
				acceptedAnswer: { "@type": "Answer", text: f.answer },
			})),
		});
	}

	return { "@context": "https://schema.org", "@graph": graph };
}
