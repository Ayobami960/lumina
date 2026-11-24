import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma"
import  { buildThreads, type ReactionKind, type Reactions, type ThreadComment} from "@/lib/conversation";
import { draftKeyPoints, isPublic, plainText, readingMinutes, sanitizeDoc, type QuizQuestion,
    type RichDoc
} from "@/lib/logic";
import { questionSchema } from "./schemas/article";
import type { ArticleCardData, ArticleStatusName, EditorArticle} from "@/types/domain";



const listInclude = {
    author: { select: { id: true, name: true, slug: true}},
    category: { select: { name: true, slug: true}},
    tags: { include: { tag: { select: {name: true, slug: true}}}},
} satisfies Prisma.ArticleInclude;

const detailInclude = {
    ...listInclude,
    author: { select: {id: true, name: true, slug: true, bio: true, image: true}},
    quiz: { select: { id: true, title: true, questions: true}},
} satisfies Prisma.ArticleInclude;


export type ArticleDetail = ArticleCardData & {
    content: RichDoc;
    videoUrl: string | null;
    audioUrl: string | null;
    viewCount: number;
    authorBio: string | null;
    authorImage: string | null;
    keyPoints: string[];
    quiz: { id: string; title: string; questions: { prompt: string; choices: string[]}[] } | null;
};


function publicWhere(now: Date): Prisma.ArticleWhereInput {
    return {
        OR: [{ status: "PUBLISHED"}, { status: "SCHEDULED", scheduledAt: { lte: now }}],
    };
}

function toCard(article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    coverImage: string;
    publishedAt: Date | null;
    scheduledAt: Date | null;
    viewCount: number;
    author: { id: string; name: string; slug: string | null; };
    category: { name: string; slug: string };
    tags: { tag: {name: string; slug: string}} [];

}): ArticleCardData{
    return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        coverImage: article.coverImage,
        publishedAt: (article.publishedAt ?? article.scheduledAt)?.toISOString() ?? null,
        viewCount: article.viewCount,
        authorId: article.author.id,
        authorName: article.author.name,
        authorSlug: article.author.slug,
        categoryName: article.category.name,
        categorySlug: article.category.slug,
        tags: article.tags.map((row) => row.tag),
    };
}



function readQuestion(value: unknown): QuizQuestion[] {
    const parsed = questionSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
}

export async function getPublishedArticles(): Promise<ArticleCardData[]>{
    "use cache";
    cacheLife("minutes");
    cacheTag("articles");
    const rows = await prisma.article.findMany({
        where: publicWhere(new Date()),
        include: listInclude,
        orderBy: { publishedAt: "desc"},
    });
    return rows.map(toCard);
}

export type LibraryCard = ArticleCardData & { keyPoints: string[]; minutes: number};


export async function getLibrary(): Promise<LibraryCard[]>{
    "use cache";
    cacheLife("minutes");
    cacheTag("articles");
    const rows = await prisma.article.findMany({
        where: publicWhere(new Date()),
        include: listInclude,
        orderBy: { publishedAt: "desc"},
    });
    return rows.map((row) => ({
        ...toCard(row),
        keyPoints: row.keyPoints.length ? row.keyPoints : draftKeyPoints(plainText(row.content)),
        minutes: readingMinutes(row.content)
    }));
}

export async function getPublishedArticle(slug: string): Promise<ArticleDetail | null> {
    "use cache";
    cacheLife("minutes");
    cacheTag("articles", `article-${slug}`);
    const article = await prisma.article.findUnique({ where: { slug }, include: detailInclude });
    if (!article || !isPublic(article.status, article.scheduledAt)) return null;
    return {
        ...toCard(article),
        content: sanitizeDoc(article.content),
        videoUrl: article.videoUrl,
        audioUrl: article.audioUrl,
        viewCount: article.viewCount,
        authorBio: article.author.bio,
        authorImage: article.author.image,
        keyPoints: article.keyPoints,
        quiz: article.quiz
            ? {
                id: article.quiz.id,
                title: article.quiz.title,
                questions: readQuestion(article.quiz.questions).map(({ prompt, choices }) => ({
                    prompt, choices }))
            }
        : null,
    };
}


export async function getCategories(){
    "use cache";
    cacheLife("hours");
    cacheTag("taxonomy");
    return prisma.category.findMany({
        orderBy: { name: "asc"},
        select: { id: true, name: true, slug: true, description: true}
    });
}

export async function getTags(){
    "use cache";
    cacheLife("hours");
    cacheTag("taxonomy");
    return prisma.category.findMany({
        orderBy: { name: "asc"},
        select: { id: true, name: true, slug: true}
    });
}



export async function getAuthor(slug: string) {
    "use cache";
    cacheLife("minutes");
    cacheTag("articles", "authors");
    const author = await prisma.user.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, bio: true, image: true, location: true,
        website: true, role: true, banned: true, createdAt: true},
    });
    if (!author || author.banned) return null;
    const rows = await prisma.article.findMany({
        where: { authorId: author.id, ...publicWhere(new Date()) },
        include: listInclude,
        orderBy: { publishedAt: "desc"},
    });
    if (!rows.length && author.role === "USER") return null;
    const stories = rows.map(toCard);
    return {
        ...author,
        joined: author.createdAt.toISOString(),
        stories,
        views: stories.reduce((sum, story) => sum + story.viewCount, 0),
        sections: [...new Set(stories.map((story) => story.categoryName))],
    };
}


export async function getAuthors() {
    "use cache";
    cacheLife("hours");
    cacheTag("articles", "authors");
    const authors = await prisma.user.findMany({
        where: { banned: false, slug: { not: null }, articles: { some: publicWhere(new Date())} },
        select: { id: true, name: true, slug: true, bio: true, image: true, _count: { select: {
            articles: { where: publicWhere(new Date()) } } } },
            orderBy: { name: "asc"},
    });
    return authors.map(({ _count, ...author}) => ({ ...author, stories: _count.articles}));
}


export async function getSettings() {
     "use cache";
    cacheLife("hours");
    cacheTag("settings");
    const settings = await prisma.siteSetting.findUnique({ where: { id: 1}});
    return (
       settings ?? {
         id: 1,
        siteName: "Lumina",
        tagline: "A calmer place for technology",
        description: "Lumina is a modern publication for people who build, design, and decide.",
       }
    );
}

export async function getEditorArticle(id: string, userId: string, isAdmin: boolean): Promise <EditorArticle | null> {
    const article = await prisma.article.findFirst({
        where: { id, ...(isAdmin ? {} : { authorId: userId })},
        include: {
            category: true,
            tags: { include: { tag: true }},
            quiz: true,
        },
    });
    if (!article) return null;
    return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: sanitizeDoc(article.content),
        coverImage: article.coverImage,
        category: article.category.name,
        tags: article.tags.map((row) => row.tag.name),
        status: article.status as ArticleStatusName,
        scheduledAt: article.scheduledAt ? toDatetimeLocal(article.scheduledAt) : "",
        videoUrl: article.videoUrl?? "",
        audioUrl: article.audioUrl ?? "",
        keyPoints: article.keyPoints,
        quizTitle: article.quiz?.title ?? "",
        questions: article.quiz ? readQuestion(article.quiz.questions) : [],
    };
}

function toDatetimeLocal(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function getWritableArticles(userId: string, isAdmin: boolean) {
    return prisma.article.findMany({
        where: isAdmin ? {} : { authorId: userId },
        include: { category: true, author: { select: { name: true } } },
        orderBy: { updatedAt: "desc"},
    });
}

export async function getBookmarks(userId: string){
    const rows = await prisma.bookmark.findMany({
        where: { userId },
        include: { article: { include: listInclude} },
        orderBy: { createdAt: "desc"},
    });
    return rows.filter((row) => isPublic(row.article.status, row.article.scheduledAt))
    .map((row) => ({ ...toCard(row.article), savedAt: row.createdAt.toISOString() }));
}

export async function getHistory(userId: string) {
    const rows = await prisma.readingHistory.findMany({
        where: { userId },
        include: { article: { include: listInclude } },
        orderBy: { readAt: "desc"},
    });
    return rows.filter((row) => isPublic(row.article.status, row.article.scheduledAt)).map((row) => ({ ...toCard(row.article), readAt: row.readAt.toISOString() }));
}

export async function getReadingBasis(userId: string): Promise<ArticleCardData[]> {
    const [saved, read] = await Promise.all([getBookmarks(userId), getHistory(userId)]);
    const moments = [
        ...saved.map((story) => ({ story, at: story.savedAt })),
        ...read.map((story) => ({ story, at: story.readAt })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const seen = new Set<string>();
    return moments
        .filter(({ story }) => !seen.has(story.id) && Boolean(seen.add(story.id)))
        .slice(0, 30)
        .map(({ story }) => story)
}


/** Visible comments for a story. nested one level deep. with like counts and the viewer's likes */
export async function getCoversation(articleId: string, viewerId?: string): Promise<ThreadComment[]>{
    const rows = await prisma.comment.findMany({
        where: { articleId, hidden: false, user: { banned: false }},
        orderBy: { createdAt: "asc"},
        take: 300,
        select: {
            id: true,
            body: true,
            createdAt: true,
            parentId: true,
            user: { select: { id: true, name: true, slug: true, image: true, role: true } },
            _count: { select: { likes: true}},
            likes: { where: { userId: viewerId ?? ""}, select: { userId: true }, take: 1}
        },
    });
    return buildThreads(
        rows.map((row) => ({
            id: row.id,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            parentId: row.parentId,
            author: row.user,
            likes: row._count.likes,
            liked: row.likes.length > 0,
        })),
    );
}


export async function getReactions(articleId: string, viewerId?: string): Promise<Reactions>{
    const [counts, mine] = await Promise.all([
        prisma.articleReaction.groupBy({ by: ["kind"], where: { articleId }, _count: { _all: true}}),
        viewerId ? prisma.articleReaction.findUnique({ where: { userId_articleId: { userId: viewerId, articleId} }, select: { kind: true}}) : null,
    ]);
    const count = (kind: ReactionKind) => counts.find((row) => row.kind === kind)?._count._all ?? 0;
    return {likes: count("LIKE"), dislikes: count("DISLIKE"), mine: mine?.kind ?? null};
}


export async function getCommentQueue() {
    return prisma.comment.findMany({
        orderBy: { createdAt: "desc"},
        take: 100,
        select: {
            id: true,
            hidden: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
            article: { select: { title: true, slug: true} },
        },
    });
}

export async function getNotifications(userId: string) {
    return prisma.notification.findMany({
        where: { userId, createdAt: { lte: new Date() } },
        orderBy: { createdAt: "desc"},
        take: 20,
    });
}

export async function getFollowing(userId: string) {
    const follows = await prisma.follow.findMany({ where: { userId }, orderBy: { createdAt: "desc"} });
    const ids =(kind: "CATEGORY" | "AUTHOR") => follows.filter((follow) => follow.kind === kind).map((follow) => follow.targetId);
    const [categories, authors] = await Promise.all([
        prisma.category.findMany({ where: { id: { in: ids("CATEGORY") } }, select: { id: true, name: true,
            slug: true, description: true
        }}),
        prisma.user.findMany({ where: { id: { in: ids("AUTHOR")}, banned: false }, select: { id: 
            true, name: true, slug: true, image: true, bio: true}}),
    ]);
    return { categories, authors };
}

export async function getAttempts(userId: string) {
    return prisma.quizAttempt.findMany({
        where: { userId },
        include: { quiz: { include: { article: { select: { title: true, slug: true } } } } },
        orderBy: { createdAt: "desc"},
    })
}

export async function isBookmarked(userId: string, articleId: string) {
    const row = await prisma.bookmark.findUnique({
        where: { userId_articleId: { userId, articleId} },
        select: { userId: true},
    });
    return Boolean(row);
}

export async function getUsers () {
    return prisma.user.findMany({
        orderBy: { createdAt: "desc"},
        select: { id: true, name: true, email: true, image: true, role: true, banned: true, 
        createdAt: true},
    });
}

export async function getModerationQueue() {
    return prisma.article.findMany({
        include: { author: { select: { name: true } }, category: true},
        orderBy: { updatedAt: "desc"},
    });
}


export async function getAnalytics () {
    const [users, articles, views, popular, byStatus, byRole, bookmarks, attempts] = await Promise.all([
        prisma.user.count(),
        prisma.article.count(),
        prisma.article.aggregate({ _sum: { viewCount: true } }),
        prisma.article.findMany({
            where: publicWhere(new Date()),
            orderBy: { viewCount: "desc"},
            take: 5,
            select: { id: true, title: true, slug: true, viewCount: true, category: { select: {
                name: true } } },
        }),
        prisma.article.groupBy({ by: ["status"], _count: { _all: true }}),
        prisma.user.groupBy({by: ["role"], _count: { _all: true} }),
        prisma.bookmark.count(),
        prisma.quizAttempt.count(),
    ]);
    const status = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Partial<Record<ArticleStatusName, number>>;
    const roles = Object.fromEntries(byRole.map((row) => [row.role, row._count._all])) as Partial<Record<"USER"| "WRITER" | "ADMIN", number>>;
    return { users, articles, views: views._sum.viewCount ?? 0, popular, status, roles, bookmarks, attempts };
}

