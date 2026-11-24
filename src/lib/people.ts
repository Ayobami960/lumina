import "server-only";
import { slugify } from "./logic";
import { prisma } from "./prisma";

export async function uniqueUserSlug(name: string, currentId?: string): Promise<string> {
    const base = slugify(name) || "reader";
    let slug = base;
    let n = 2;
    for (;;) {
        const found = await prisma.user.findUnique({ where: { slug}, select: { id: true }});
        if (!found || found.id === currentId) return slug;
        slug = `${base}-${n++}`
    }
};

