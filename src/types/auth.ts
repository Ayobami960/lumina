import type { DefaultSession } from "next-auth";
import type {} from "next-auth/jwt";

export type RoleName = "USER" | "WRITER" | "ADMIN";

declare module "next-auth" {
    interface User {
        role: RoleName;
    }

    interface Session {
        user: {
            id: string;
            role: RoleName;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: RoleName;
    }
}

