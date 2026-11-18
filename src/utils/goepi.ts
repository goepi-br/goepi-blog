/** Utilitários do layout GoEPI (homeBlog.pdf / itemBlog.pdf). */

export const SITE_URL = "https://www.goepi.com.br";
export const FALLBACK_IMAGE = "/goepi/hero-bg.jpg";
export const CATEGORY_ORDER = [
	"Novidades",
	"Atualizações",
	"Treinamentos",
	"Dicas",
	"Segurança",
	"Tecnologia",
	"Recursos do Sistema",
];

/** Divide o título em destaque (duas primeiras palavras) e resto. */
export function splitTitle(title: string, words = 2): [string, string] {
	const parts = title.trim().split(/\s+/);
	if (parts.length <= words) return [title.trim(), ""];
	return [parts.slice(0, words).join(" "), parts.slice(words).join(" ")];
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "10 Jun 2026", como nos PDFs. */
export function formatShortDate(date: Date | string | null | undefined): string {
	if (!date) return "";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "";
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** URL da imagem destacada (objeto de imagem do EmDash) ou a imagem padrão. */
export function imageUrl(img: unknown): string {
	if (img && typeof img === "object") {
		const image = img as Record<string, unknown>;
		if (typeof image.src === "string" && image.src) return image.src;
		const meta = image.meta as Record<string, unknown> | undefined;
		const key =
			(typeof meta?.storageKey === "string" ? meta.storageKey : undefined) ||
			(typeof image.id === "string" ? image.id : undefined);
		if (key) return `/_emdash/api/media/file/${key}`;
	}
	return FALLBACK_IMAGE;
}

export function sortCategories<T extends { label: string }>(terms: T[]): T[] {
	const rank = (label: string) => {
		const i = CATEGORY_ORDER.indexOf(label);
		return i < 0 ? 99 : i;
	};
	return [...terms].sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "pt-BR"));
}
