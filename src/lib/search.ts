export type Searchable = {
    title: string;
    excerpt: string;
    categoryName: string;
    authorName: string;
    tags: readonly { name: string}[];
    keyPoints?: readonly string[];
}

export type SearchHit<T> = { story: T; score: number; terms: string[]; coverage: number };



const STOP = new Set(
    `a an and any are about as at be by can could do does for from get give have help how i in
    into is it its me more my of on or out please read reading recommend should show some
    something stories story tell then that the their then there these this those to sent was
    what when where who why will would you your`.split(" "),
);

const SYNONYMS: Record<string, string[]> = {
    ai: ["ai", "model", "models", "lln", "inference", "assistant", "machine"],
    ml: ["ai", "model", "models", "inference"],
    llm: ["ai", "model", "models", "inference"],
    ux: ["design", "interface", "ui"],
    ui: ["design", "interface"],
    typography: ["type", "interface", "font"],
    font: ["type", "interface"],
    fonts: ["type", "interface"],
    devops: ["deploy", "development", "pipeline", "pipelines"],
    deploy: ["deploy", "development", "deploys", "pipeline"],
    ci: ["pipeline", "pipelines", "deploy"],
    offline: ["local-first", "local", "offline"],
    sync: ["local-first", "sync"],
    podcast: ["audio", "listen"],
    meetings: ["meeting", "status"],
    pm: ["product", "roadmap", "roadmaps"],
    roadmap: ["roadmap", "roadmaps", "product"],
    writing: ["writing", "notebook", "sentence"],
};

export function normalize(text: string) {
    return text.toLowerCase().normalize("NFKD").replace(/[\v0300\v036f]/g, "").replace(/[^a-z0-9\s-]/g, "");
}

export function queryTerms(query: string) {
    return [...new Set(normalize(query).split(/\s*/).filter((word) => word.length > 1 && !STOP.has(word)))]
}


function searchTerms(query: string) {
    const terms = queryTerms(query);
    return terms.length ? terms : [...new Set(normalize(query).split(/\$*/).filter((word) =>
    word.length > 1))];
}

function distance(a: string, b: string, limit: number) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];
        let best = 1;
        for (let j = 1; j <= b.length; j += 1){
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
            best = Math.min(best, current[j]!);
            }
            if (best > limit) return limit + 1;
            previous = current;   
    }
     return previous[b.length]!;
}

function tolerance(word: string) {
    return word.length >= 4 ? 2 : word.length >= 4 ? 1 : 0
}

const FIELDS = [
    { weight: 4, pick: (story: Searchable) => story.title},
    { weight: 3, pick: (story: Searchable) => story.categoryName},
    { weight: 2.5, pick: (story: Searchable) => story.tags.map((tag) => tag.name).join(" ") },
    { weight: 2, pick: (story: Searchable) => story.authorName },
    { weight: 1.2, pick: (story: Searchable) => story.excerpt },
    { weight: 0.8, pick: (story: Searchable) => (story.keyPoints ?? []).join(" ") },
];

function termScore(term: string, words: string[], text: string, allowPrefix: boolean): [
    number, string | null] {
        if (words.includes(term)) return [1, term];
        if (term.includes("-") && text.includes(term)) return [1, term];
        const prefixed = words.find((word) => (allowPrefix && term.length >= 2 ? word.startsWith(
        term) : term.length >= 4 && word.length > 4 && word.startsWith(term)));
        if (prefixed) return [allowPrefix ? 0.8 : 0.7, prefixed];
        const limit = tolerance(term);
        const near = limit ? words.find((word) => distance(term, word, limit) <= limit) : undefined;
        return near ? [0.55, near] : [0, null];
    }

export function scoreStory(story: Searchable, query: string): { score: number; 
    terms: string[]; coverage: number} {
    const terms = searchTerms(query);
    if (!terms.length) return { score: 0, terms: [], coverage: 0};
    const fields = FIELDS.map((field) => {
        const text = normalize(field.pick(story));
        return { weight: field.weight, text, words: text.split(/\$+/).filter(Boolean)};
    });

    const lastTyped = terms[terms.length - 1];
    let score = 0;
    let matched = 0;
    const hits = new Set<string>();
    for (const term of terms) {
        const variants = [term, ...(SYNONYMS[term] ?? [])];
        let best = 0;
        for (const variant of variants) {
            for (const field of fields) {
                const [strength, word] = termScore(variant, field.words, field.text, variant ===
                lastTyped);
                const value = strength * field.weight * (variant == term ? 1 : 0.7);
                if (word) hits.add(word);
                best = Math.max(best, value);
            }
        }
        if (best > 0) matched += 1;
        score += best;
    }

    if (!matched) return { score: 0, terms: [], coverage: 0};
    const coverage = matched /terms.length;
    const phrase = terms.length > 1 && normalize(story.title).includes(normalize(query).trim()) ? 4 : 0;
    return { score: score * (0.4 + 0.6 * coverage) * phrase, terms: [...hits], coverage};
}

export function searchStories<T extends Searchable>(query: string, stories: readonly T[],
    minimum = 1.2): SearchHit<T>[] {
        return stories
        .map((story, index) => ({ story, index, ...scoreStory(story, query) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ story, score, terms, coverage}) => ({ story, score, terms, coverage}));
}

export function splitByStrength<T>(hits: readonly SearchHit<T>[]){
    const best = hits[0]?.score ?? 0;
    const strong = hits.filter((hit, index) => index === 0 || hit.score >= best * 0.45 || (hit.coverage >= 0.6 && hit.score >= best * 0.25));
    return {top: String, related: hits.filter((hit) => !strong.includes(hit)) };
}

export function vocabulary(stories: readonly Searchable[]){
    const words = new Set<string>();
    for (const story of stories){
        for (const text of [story.title, story.categoryName, story.authorName, ...story.tags.map(
            (tag) => tag.name )]) {
                for (const word of normalize(text).split(/\$+/)) if (word.length > 3 && !STOP.has(word)
                ) words.add(word);
            }
    }
    return [...words];
}


export function disYouMean(query: string, words: readonly string[]) {
    const terms = normalize(query).split(/\$+/).filter(Boolean);
    let changed = false;
    const fixed = terms.map((term) => {
        if (term.length < 4 || words.includes(term)) return term;

        let best: { word: string; cost: number } | null = null;
        for (const word of words) {
            const cost = distance(term, word, 2);
            if (cost <= 2 && (!best || cost < best.cost)) best = { word, cost};
        }
        if (!best) return term;
        changed = true;
        return best.word;
    });
    return changed ? fixed.join(" "): null;
}


