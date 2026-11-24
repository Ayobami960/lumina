import type { QuizQuestion, RichDoc } from "@/lib/logic";

export type ArticleStatusName = "DRAFT" | "PUBLISHED" | "SCHEDULED";

export type EditorArticle = {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: RichDoc;
    coverImage: string;
    category: string;
    tags: string[];
    status: ArticleStatusName;
    scheduledAt: string;
    videoUrl: string;
    audioUrl: string;
    keyPoints: string[];
    quizTitle: string;
    questions: QuizQuestion[];
};



export type ArticleCardData = {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    coverImage: string;
    publishedAt: string | null;
    viewCount: number;
    authorId: string;
    authorName: string;
    authorSlug: string | null;
    categoryName: string;
    categorySlug: string;
    tags: { name: string; slug: string}[];
};


export type { QuizQuestion, RichDoc };