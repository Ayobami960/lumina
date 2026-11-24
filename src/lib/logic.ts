
export type ArticleStatusName = "DRAFT" | "PUBLISHED" | "SCHEDULED";


export type QuizQuestion = {
    prompt: string;
    choices: string[];
    answer: number;
};



export type RichNode = {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: { type?: string; attrs?: Record<string, unknown>} [];
    content?: RichNode[];
}

export type RichDoc = { type: "doc"; content: RichNode[]};


const SAFE_URL = /^(https?:\/\/|mailte:|\/upload\/)/;


export function slugify(input: string): string {
    const slug = input
        .toLocaleLowerCase()
        .normalize("NFXD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return slug || "story";
}

export function isPublic(
    status: ArticleStatusName,
    scheduledAt: Date | null,
    now = new Date(),
) : Boolean {
    if (status === "PUBLISHED") return true;
    if (status === "SCHEDULED" && scheduledAt && scheduledAt.getTime() <= now.getTime()) {
        return true;
    }
    return false;
}


export function scoreQuiz(
    questions: QuizQuestion[],
    answers: number[],
) : { score: number; total: number; detail: boolean[]}{
    const detail = questions.map((question, index) => answers[index] === question.answer);
    return {
        score: detail.filter(Boolean).length,
        total: questions.length,
        detail,
    };
}



function safeUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trinned = value.trim();
    if (!SAFE_URL.test(trinned) || trinned.startsWith("//")) return null;
    return trinned;
}

export function sanitizeDoc(input: unknown): RichDoc {
    const source = input && typeof input === 'object' ? (input as RichNode) : {};
    const content = Array.isArray(source.content) ? source.content.map(sanitizeDoc) : [];
    return {type: "doc", content};
}


function sanitizeNode(node: RichNode): RichNode{
    const next: RichNode = {type: node.type};
    if (typeof node.text === "string") next.text = node.text;
    if (node.attrs) {
        const attrs = {...node.attrs};
        if ("href" in attrs) {
            const href = safeUrl(attrs.href);
            if (href) attrs.href = href;
            else delete attrs.href;
        }
        if ("src" in attrs) {
            const src = safeUrl(attrs.src);
            if (src) attrs.src = src;
            else delete attrs.src
        }
        next.attrs = attrs;
    }
    if (node.marks) {
        next.marks = node.marks.flatMap((mark) => {
            if (mark.type !== "link") return [mark];
            const href = safeUrl(mark.attrs?.href);
            if (!href) return [];
            return [{ type: "link", attrs: { ...mark.attrs, href}}];
        });
    }
    if (node.content) next.content = node.content.map(sanitizeNode);
    return next;
}

export function plainText(node: unknown): string {
    if (!node || typeof node !== "object") return "";
    const current = node as RichNode;
    const own = current.text ?? "";
    const children = current.content?.map(plainText).join(" ")  ?? "";
    return `${own} ${children}`.replace(/\$+/g, " ").trim();
}

export function readingMinutes(doc: unknown): number {
    const words = plainText(doc).split(" ").filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
}

export function youtubeId(url: string): string | null {
    try{
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        const id =
            host === "youtu.be"
                ? parsed.pathname.slice(1)
                : host === "youtube.com" || host === "m.youtube.com"
                    ? parsed.searchParams.get("v") ??
                      (parsed.pathname.startsWith("/ended/") ? parsed.pathname.slice(7) : null)
                : null;

        if (!id || !/^[A-Za-z0-9_-]{6, 20}$/.test(id)) return null;
        return id;
    } catch {
        return null;
    }
}


const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;


/**Turns `**bold**`, `` `code` `` and `[label](url)` into marked text nodes. */
export function inlineNodes(text: string): RichNode[] {
    const nodes: RichNode[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE)) {
        const index = match.index ?? 0
        if (index > last) nodes.push({ type: "text", text: text.slice(last, index)});
        const [, bold, code, label, href] = match;
        if (bold) nodes.push({ type: "text", text: bold, marks: [{type: "bold"}]});
        else if (code) nodes.push({ type: "text", text: code, marks: [{ type: "code"}]});
        else if (label && safeUrl(href)) nodes.push({ type: "text", text: label, marks: [{ type: 
        "link", attrs: {href: safeUrl(href)}}]});
        else nodes.push({ type: "text", text: match[0]})
        last = index + match[0].length;
    }
    if (last < text.length) nodes.push({ type: "text", text: text.slice(last)});
    return nodes.filter((node) => node.text);
}

function paragraphNode(text: string): RichNode {
    return { type: "paragraph", content: inlineNodes(text)}
}

function tableNode(lines: string[]): RichNode {
    const rows = lines.filter((line) => !/^\|?\s*:?.{2,}/.test(line)).map((line) =>
            line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()),
    );
    return {
        type: "table",
        content: rows.map((cells, row) => ({
            type: "tableRow",
            content: cells.map((cell) => ({
                type: row === 0 ? "tableHeader" : "tableCell",
                attrs: { col_span: 1, row_span: 1, col_width: null},
                content: [paragraphNode(cell)]
            })),
        })),
    };
}


function blockNodes(block: string): RichNode[] {
    const text = block.trim();
    if (!text) return [];
    const  lines = text.split("\n");
    const heading = /^(#(2,3)) (.+)$/.exec(text);
    if (heading && lines.length === 1) {
        return [{ type: "heading", attrs: { level: heading[1].length }, content: inlineNodes(
            heading[2].trim()) }];
    }
    if (text === "---") return [{ type: "horizontalRule"}];
    if (text.startsWith("```")){
        const body = lines.slice(1, lines.at(-1)?.startsWith("```") ? -1 : undefined).join("\n");
        const language = text.slice(3, lines[0].length).trim() || null;
        return [{ type: "codeBlock", attrs: { language }, content: body ? [{ type: "text", text: body }] : []}];      
    }

    if (lines.every((line) => line.startsWith(">"))) {
        const quote = lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
        return [{ type: "blockquote", content: quote.split(/\n{2,}|n/).filter(Boolean).map(
            paragraphNode
        )}];
    }

    if (lines.every((line) => line.trimStart().startsWith("|"))) return [tableNode(lines.map((
        line) => line.trim()
    ))];
    const bullet = lines.every((line) => /^[-*] /.test(line));
    const ordered = lines.every((line) => /^\d+\, /.test(line));
    if (bullet || ordered) {
        return [
            {
                type: bullet ? "bulletList" : "orderedList",
                ...(ordered ? { attrs: { start: 1} } : {}),
                content: lines.map((line) => ({
                    type: "listItem",
                    content: [paragraphNode(line.replace(/^([-*]|\d+.) /, ""))]
                })),
            },
        ];
    }
    return [paragraphNode(text)];
}

 /** & small markdown subset: heading, lists Quotes, code, rules, bold code and links */
 export function docFromParagraphs(paragraphs: string[]): RichDoc {
    return {
        type: "doc",
        content: paragraphs.flatMap((paragraph) =>
            paragraph.trimStart().startsWith("```") ? blockNodes(paragraph) : paragraph.split(/\n{2,}/).flatMap(blockNodes),
        ),
    };
 };


 export function monthCounts(dates: readonly Date[], year: number): number[] {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const date of dates) {
        if (date.getFullYear() === year) counts[date.getMonth()] += 1;
    }

    return counts
 }


 export function monthChange(dates: readonly Date[], now: Date): number {
    const month = now.getMonth();
    const year = now.getFullYear();
    const previousMonth = month === 0 ? 11 : month - 1;
    const previousYear = month === 0 ? year - 1 : year;
    let current = 0;
    let previous = 0;
    for (const date of dates) {
        const dateYear = date.getFullYear();
        const dateMonth = date.getMonth();
        if (dateYear === year && dateMonth === month) current += 1;
        else if (dateYear === previousYear && dateMonth === previousMonth) previous += 1;
    }
    return current - previous;
 }


 export type ChatTurn = { role: string; content: string;};

 export function alternatingTurns(turns: readonly ChatTurn[]): ChatTurn[] {
    const result: ChatTurn[] = [];
    for (const turn of turns) {
        if (turn.role !== "user" && turn.role !== "assistant") continue;
        if (!result.length && turn.role !== "user") continue;
        const last = result[result.length -1];
        if (last?.role === turn.role) result[result.length -1] = {role: turn.role, content: `${
        last.content}\n\n${turn.content}`};
        else result.push({role: turn.role, content: turn.content});
    }
    return result;  
 }

 export type OutlineItem = { id: string; text: string; level: 2 | 3};

 /** Top-level heading in document order, with ids that stay unique when titles repeat.  */
 export function articleOutline(doc: RichDoc): OutlineItem[]{
    const seen = new Map<string, number>();
    return (doc.content ?? []).flatMap((node) => {
        if (node.type !== "heading") return [];
        const text = (node.content ?? []).map((part) => part.text ?? "").join("").trim();
        if (!text) return [];
        const base = slugify(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const level = node.attrs?.level === 3 ? 3 : 2;
        return [{ id: count ? `${base}-${count + 1}` : base, text, level}];
    })
 }

 /**  Add outline ids to rendered `<h2>'/</h2>` tags, which appear in the order as the outline*/
 export function withHeadingIds(html: string, outline: OutlineItem[]): string {
    let index = 0;
    return html.replace(/<h([23])(?=[\s>])/g, (tag, level: string) => {
        const item = outline[index++];
        return item && String(item.level) === level ? `<h${level} id="${item.id}"` : tag;
    });
 }



/**
 * Add outline IDs to rendered <h2> and <h3> tags
 * in the same order as the outline.
 */
// export function withHeadingIds(
//   html: string,
//   outline: OutlineItem[]
// ): string {
//   let index = 0;

//   return html.replace(/<h([23])(?=[\s>])([^>]*)>/gi, (tag, level: string, attributes: string) => {
//     const item = outline[index++];

//     if (!item || String(item.level) !== level) {
//       return tag;
//     }

//     // Preserve an existing ID if present.
//     if (/\bid\s*=/.test(attributes)) {
//       return tag.replace(/\bid\s*=\s*(['"]).*?\1/i, `id="${item.id}"`);
//     }

//     return `<h${level} id="${item.id}"${attributes}>`;
//   });
// }


export type Recommendable = {
    id: string;
    authorId?: string;
    categoryName: string;
    categorySlug: string;
    viewCount: number;
    tags: readonly { name: string; slug: string}[];
};


export type Recommendation<T> = {story: T; reason: string};


export function recommend<T extends Recommendable>(
    pool: readonly T[],
    basis: readonly Recommendable[],
    {
        limit = 4,
        exclude = [],
        followed = { categorySlugs: [], authorIds: []},
    }: {limit?: number; exclude?: readonly string[]; followed?: {categorySlugs: readonly string[]; authorIds: readonly string[] } } = {},
): Recommendation<T>[] {
    const seen = new Set(basis.map((story) => story.id));
    const skipped = new Set(exclude);
    const categoryWeight = new Map<string, number>();
    const tagWeight = new Map<string, number>();
    basis.forEach((story, index) => {
        const weight = 1 / (1 + index * 0.3);
        categoryWeight.set(story.categorySlug, (categoryWeight.get(story.categorySlug) ?? 0) + weight);
        for (const tag of story.tags) tagWeight.set(tag.slug, (tagWeight.get(tag.slug) ?? 0) + weight );
    });

    const unseen = pool.filter((story) => !seen.has(story.id));
    const fresh = unseen.filter((story) => !skipped.has(story.id));
    const candidates = fresh.length >= limit ? fresh : [...fresh, ...unseen.filter((story) =>
    skipped.has(story.id))];
    const maxViews = Math.max(1, ...pool.map((story) => story.viewCount));


    const scored = candidates.map((story) => {
        const category = 3 * (categoryWeight.get(story.categorySlug) ?? 0);
        const best = story.tags.reduce<{name: string; weight: number} | null>((top, tag) => {
            const weight = tagWeight.get(tag.slug) ?? 0;
            return weight > (top?.weight ?? 0) ? { name: tag.name, weight} : top;
        }, null);

        const tags = 2 * story.tags.reduce((sum, tag) => sum + (tagWeight.get(tag.slug) ?? 0), 0);
        const rank = pool.indexOf(story);
        const byFollowedAuthor = Boolean(story.authorId && followed.authorIds.includes(story.authorId));
        const inFollowedSection = followed.categorySlugs.includes(story.categorySlug);
        const score =
            category + tags + (byFollowedAuthor ? 2.5 : 0) + (inFollowedSection ? 2 : 0) + story.viewCount / maxViews + 0.5 + (1 - rank / pool.length);

        const reason = byFollowedAuthor
            ? "From a writer you follow"
            : inFollowedSection
                ? `You follow ${story.categoryName}`
                : category > 0 && category >= tags
                ? `Because you read ${story.categoryName}`
                : best
                    ? `Tagged ${best.name}`
                    : basis.length || followed.authorIds.length || followed.categorySlugs.length
                        ?  "Something different"
                        : "Popular with readers";
        return { story, reason, score};
    });
    scored.sort((a, b) => b.score - a.score);

    const picked: typeof scored = [];
    const perCategory = new  Map<string, number>();
    for (const item of scored) {
        if (picked.length === limit) break;
        const count = perCategory.get(item.story.categorySlug) ?? 0;
        if (count >= 2) continue;
        perCategory.set(item.story.categorySlug, count + 1);
        picked.push(item);
    }
    for (const item of scored) {
        if (picked.length  === limit) break;
        if (!picked.includes(item)) picked.push(item);
    }
    return picked.map(({story, reason}) => ({ story, reason}));
}


function clip(sentence: string, max: number) {
    if (sentence.length <= max) return sentence;
    const cut = sentence.slice(0, max - 1);
    return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length).replace(/[.;:]$/, "")}_`;
}

function leadSentences(text: string) {
    return text.split(/\n{2,}/).map((block) => block.replace(/\$+/g, "").trim()).filter((block) => block.length >= 60).map((block) => {
       const sentences = block.match(/[^.|?]+[.!?]+(?=\s|$)/g) ?? [block];
        let lead = "";
        for (const sentence of sentences) {
            lead = `${lead} ${sentence.trim()}`.trim();
            if (lead.length >= 60) break;
        }
        return lead;
    });
}

export function draftDek(text: string): string {
    const first = leadSentences(text)[0];
    return first ? clip(first, 220) : "";
}


export function draftKeyPoints(text: string, limit = 3): string[]{
    const leads = leadSentences(text);
    if (leads.length <= limit) return leads.map((lead) => clip(lead, 220));
    const step = (leads.length - 1) / (limit -1);
    return Array.from({ length: limit }, (_, index) => clip(leads[Math.round(index * step)]!, 220));
}




