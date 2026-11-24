import "server-only";
import { headers} from "next/headers";

const buckets = new Map<string, number[]>();

// In memory per server instance. $wap for Redis or Upstash when running more one Instance

export function rateLimit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (buckets.get(key) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= max){
        buckets.set(key, recent);
        return false;
    }
    recent.push(now);
    buckets.set(key, recent);
    return true;
}

export function clearLimit(key: string){
    buckets.delete(key);
}

export function ipFrom(source: Headers): string {
    return source.get("x-forwarded-for")?.split(",")[0]?.trim() || source.get("x-real-ip") || "local"
}

export async function clientIp(): Promise<string> {
    return ipFrom(await headers());
}