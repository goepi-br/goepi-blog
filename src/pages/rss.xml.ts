import type { APIRoute } from "astro";

export const GET: APIRoute = ({ redirect }) => redirect("/blog/rss.xml", 301);
