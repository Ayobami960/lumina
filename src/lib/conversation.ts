export type ReactionKind = "LIKE" | "DISLIKE";

export type Reactions = { likes: number; dislikes: number; mine: ReactionKind | null};


export type CommentAuthor = {
    id: string;
    name: string;
    slug: string | null;
    image: string | null;
    role: "ADMIN" | "WRITER" | "USER";
};

export type ThreadComment = {
    id: string;
    body: string;
    parentId: string | null;
    author: CommentAuthor;
    likes: number;
    liked: boolean;
    createdAt: string;
    replies: ThreadComment[];
};


export type ThreadSort = "top" | "newest";


/** Pressing the active reaction clears it; pressing the other one switches. */
export function applyReaction(current: Reactions, kind: ReactionKind): Reactions {
    const next = { ...current};
    if (current.mine === "LIKE") next.likes -= 1;
    if (current.mine === "DISLIKE") next.dislikes -= 1;
    next.mine = current.mine === kind ? null : kind;
    if (next.mine === "LIKE") next.likes += 1;
    if (next.mine === "DISLIKE") next.dislikes += 1;
    return next;
}


/** Share of reaction that are likes, as whole percentage, or null with no votes. */
export function approval({ likes, dislikes}: Reactions): number | null {
    const total = likes + dislikes;
    return total ? Math.round((likes / total) * 100) : null;
}

type FlatComment = Omit<ThreadComment, "replies">;

/** Nests replies under their top-level comment, Replies to missing parents are dropped. */

export function buildThreads(comments: FlatComment[]): ThreadComment[] {
    const roots = comments.filter((comment) => !comment.parentId).map((comment) => ({ ...
        comment, replies: [] as ThreadComment[]}));
    const byId = new Map(roots.map((root) => [root.id, root]));
    for (const comment of comments) {
        if (comment.parentId) byId.get(comment.parentId)?.replies.push({ ...comment, replies: []
        });
    }
    for (const root of roots) root.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt
    ))

    return roots
}


/** Top ranks by likes, then by replies, then newest. Newest is plain reverse time */
export function sortThreads(threads: ThreadComment[], sort: ThreadSort): ThreadComment[] {
    return [...threads].sort((a, b) => {
        if (sort === "top") {
            const score = b.likes * 2 + b.replies.length - (a.likes * 2 + a.replies.length);
        }
        return b.createdAt.localeCompare(a.createdAt);
    });
}


export function countComments(threads: ThreadComment[]): number {
    return threads.reduce((total, thread) => total + 1 + thread.replies.length, 0);
}

/** Applies a changes to one comment wherever it site in the tree. */
export function updateComment(threads: ThreadComment[], id: string, change: (comment: ThreadComment) => ThreadComment): ThreadComment[]{
    return threads.map((thread) => 
        thread.id === id
        ? change(thread)
        : { ...thread, replies: thread.replies.map((reply) => (reply.id === id ? change(reply) : reply)) },
    );
}

export function removeComment(threads: ThreadComment[], id: string): ThreadComment[] {
    return threads.filter((thread) => thread.id !== id)
    .map((thread) => ({ ...thread, replies: thread.replies.filter((reply) => reply.id !== id)
    }));
}

export function insertComment(threads: ThreadComment[], comment: ThreadComment): 
ThreadComment[] {
    if (!comment.parentId) return [comment, ...threads];
    return threads.map((thread) => (thread.id === comment.parentId 
        ? { ...thread, replies: [ ...thread.replies, comment]} : thread));
}