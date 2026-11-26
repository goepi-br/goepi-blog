/**
 * CTAs de conversão nas páginas de artigo do Blog GoEPI.
 *
 * Recebe o Portable Text do post e devolve uma cópia com blocos próprios
 * (`_type: "goepiCta"`) inseridos nos pontos de conversão:
 * - o link "Agendar demonstração" para /#demonstracao vira botão;
 * - um banner escuro depois da 2ª seção H2 (ou da 1ª, com menos de 3 H2);
 * - um banner claro antes de "Perguntas frequentes" (ou da última H2).
 *
 * O valor original não é alterado: no modo de edição do EmDash o conteúdo
 * vai intacto para o editor.
 */

export type CtaVariantKey = "estoque" | "entrega" | "auditoria" | "default";
export type CtaPosition = "inline_button" | "banner_mid" | "banner_end" | "sidebar";

export interface CtaVariant {
	key: CtaVariantKey;
	/** Título em partes: os trechos com `highlight` recebem a cor de destaque. */
	headline: Array<{ text: string; highlight?: boolean }>;
	support: string;
}

export interface CtaNode {
	_type: "goepiCta";
	_key: string;
	kind: "button" | "banner";
	position: CtaPosition;
	tone?: "dark" | "light";
	variant: CtaVariant;
}

export const DEMO_HREF = "/#demonstracao";
export const DEMO_LABEL = "Agendar demonstração";
export const WHATSAPP_HREF = "https://wa.me/5512997384873";

const VARIANTS: Array<{ test: RegExp; variant: CtaVariant }> = [
	{
		test: /\b(estoque|almoxarifado|compra|reposicao)/,
		variant: {
			key: "estoque",
			headline: [
				{ text: "Seu " },
				{ text: "estoque de EPI", highlight: true },
				{ text: " bate com o que está na prateleira?" },
			],
			support: "Entrega e estoque no mesmo registro, com alerta antes da ruptura.",
		},
	},
	{
		test: /\b(entrega|ficha|biometria|assinatura|reconhecimento)/,
		variant: {
			key: "entrega",
			headline: [
				{ text: "Sua equipe ainda perde horas com " },
				{ text: "ficha de EPI em papel", highlight: true },
				{ text: "?" },
			],
			support: "Entrega registrada com reconhecimento facial e assinatura digital, em segundos.",
		},
	},
	{
		test: /\b(auditoria|fiscalizacao|nr-?6\b|ca\b|validade|comprovacao)/,
		variant: {
			key: "auditoria",
			headline: [
				{ text: "Se a fiscalização chegasse hoje, você " },
				{ text: "provaria cada entrega", highlight: true },
				{ text: "?" },
			],
			support: "Histórico por colaborador pronto para auditoria, a poucos cliques.",
		},
	},
];

const DEFAULT_VARIANT: CtaVariant = {
	key: "default",
	headline: [{ text: "Sua gestão de EPI " }, { text: "resiste a uma auditoria", highlight: true }, { text: "?" }],
	support: "Veja a GoEPI funcionando na sua operação, sem implantação complexa.",
};

/** Minúsculas, sem acentos. */
export function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();
}

/** Variante do banner pelo título e pelo slug do post (primeira regra que casar). */
export function pickVariant(title: string, slug: string): CtaVariant {
	const haystack = normalize(`${title} ${slug.replace(/-/g, " ")} ${slug}`);
	return VARIANTS.find((v) => v.test.test(haystack))?.variant ?? DEFAULT_VARIANT;
}

// ---------------------------------------------------------------------------
// Portable Text

type Span = { _type?: string; text?: string; marks?: string[] };
type MarkDef = { _key?: string; _type?: string; href?: string };
type Block = {
	_type?: string;
	_key?: string;
	style?: string;
	listItem?: string;
	children?: Span[];
	markDefs?: MarkDef[];
	[k: string]: unknown;
};

const isTextBlock = (b: Block | undefined): boolean => !!b && b._type === "block";
const isHeading = (b: Block | undefined, level: string) => isTextBlock(b) && b!.style === level;
const isParagraph = (b: Block | undefined) => isTextBlock(b) && (!b!.style || b!.style === "normal") && !b!.listItem;
const isCta = (b: Block | CtaNode | undefined) => !!b && b._type === "goepiCta";
const blockText = (b: Block) => (b.children ?? []).map((c) => c.text ?? "").join("");

/** "Agendar demonstração" com ou sem pontuação no fim, maiúsculas e acentos ignorados. */
function isDemoLabel(text: string): boolean {
	const clean = normalize(text)
		.replace(/[\s.,;:!?…)"'»]+$/u, "")
		.replace(/^[\s("'«]+/u, "")
		.replace(/\s+/g, " ");
	return clean === "agendar demonstracao";
}

const isDemoHref = (href: string | undefined) => !!href && /#demonstracao$/i.test(href.trim());

/**
 * Procura no bloco um link de demonstração. Devolve "standalone" quando o
 * parágrafo é só o link, "inline" quando o link está no meio de uma frase.
 */
function findDemoLink(b: Block): "standalone" | "inline" | null {
	if (!isTextBlock(b) || (b.style && b.style !== "normal")) return null;
	for (const def of b.markDefs ?? []) {
		if (def._type !== "link" || !def._key || !isDemoHref(def.href)) continue;
		const linkText = (b.children ?? [])
			.filter((c) => c.marks?.includes(def._key!))
			.map((c) => c.text ?? "")
			.join("");
		if (!isDemoLabel(linkText)) continue;
		const rest = (b.children ?? [])
			.filter((c) => !c.marks?.includes(def._key!))
			.map((c) => c.text ?? "")
			.join("");
		return /^[\s.,;:!?…]*$/u.test(rest) ? "standalone" : "inline";
	}
	return null;
}

/**
 * Insere os CTAs no conteúdo. Não altera `value`; devolve um novo array.
 */
export function injectCtas(value: unknown, variant: CtaVariant): Array<Block | CtaNode> {
	const source: Block[] = Array.isArray(value) ? (value as Block[]) : [];
	let n = 0;
	const cta = (props: Omit<CtaNode, "_type" | "_key" | "variant">): CtaNode => ({
		_type: "goepiCta",
		_key: `goepi-cta-${n++}`,
		variant,
		...props,
	});

	// 1. Botão de demonstração: o parágrafo que é só o link vira botão; o link
	// no meio de uma frase continua no texto e o botão entra logo depois do
	// parágrafo (ou da lista inteira, para não partir a lista).
	const out: Array<Block | CtaNode> = [];
	let pendingAfterList = false;
	for (let i = 0; i < source.length; i++) {
		const b = source[i];
		const found = findDemoLink(b);
		if (found === "standalone" && !b.listItem) {
			out.push(cta({ kind: "button", position: "inline_button" }));
			continue;
		}
		out.push(b);
		if (found) {
			if (b.listItem) pendingAfterList = true;
			else out.push(cta({ kind: "button", position: "inline_button" }));
		}
		if (pendingAfterList && !source[i + 1]?.listItem) {
			out.push(cta({ kind: "button", position: "inline_button" }));
			pendingAfterList = false;
		}
	}

	const h2s = () => out.map((b, i) => (isHeading(b as Block, "h2") ? i : -1)).filter((i) => i >= 0);
	const touchesCta = (at: number) => isCta(out[at - 1]) || isCta(out[at]);

	// 2. Banner do meio: depois da 2ª seção H2 (antes da 3ª H2) ou, com menos
	// de 3 H2, depois da 1ª seção. Se ali já houver um botão, desce para depois
	// do parágrafo seguinte.
	const headings = h2s();
	if (headings.length === 0) return out;
	let mid = headings.length >= 3 ? headings[2] : (headings[1] ?? out.length);
	let guard = 0;
	while (touchesCta(mid) && guard++ < 10) {
		let next = mid;
		while (next < out.length && !isParagraph(out[next] as Block)) next++;
		if (next >= out.length) break;
		mid = next + 1;
	}
	out.splice(mid, 0, cta({ kind: "banner", position: "banner_mid", tone: "dark" }));

	// 3. Banner do fim: antes de "Perguntas frequentes" ou, sem FAQ, antes da
	// última H2. Se esse ponto cair em cima do banner do meio, vai para o fim
	// do artigo. Se houver um botão logo antes, sobe para antes do parágrafo
	// que precede o botão, para não empilhar dois CTAs.
	const after = h2s();
	const faq = after.find((i) => normalize(blockText(out[i] as Block)).trim().startsWith("perguntas frequentes"));
	let end = faq ?? after[after.length - 1];
	const midAt = out.findIndex((b) => isCta(b) && (b as CtaNode).position === "banner_mid");
	if (end === undefined || end <= midAt + 1) end = out.length;
	guard = 0;
	while (touchesCta(end) && guard++ < 10) {
		let p = end - 1;
		while (p > midAt + 1 && !isParagraph(out[p] as Block)) p--;
		if (p <= midAt + 1) break;
		end = p;
	}
	// Nunca dois banners colados: se não sobrar texto entre eles, fica só o do meio.
	if (end > midAt + 1) out.splice(end, 0, cta({ kind: "banner", position: "banner_end", tone: "light" }));
	return out;
}
