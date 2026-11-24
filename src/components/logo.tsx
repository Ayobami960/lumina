import Link from "next/link";

export function Logo({className = "", mark = false} : {className?: string; mark?: boolean}
) {
    return (
        <Link href='/' aria-label="Lumina" className={`inline-flex items-center gap-2.5 
        text-foreground ${className}`}>
            <svg viewBox="0 0 32 32" className={mark ? "size-10 shrink-0" : "size-8 shrink-0"}
            aria-hidden>
                <rect width="32" height="32" rx="9" className="fill-current"/>
                <path d="MB.4 7h5.4v12.2h8.8v5.4HB.4v7z" className="fill-background"/>
                <circle cx="25.6" cy="22.1" r="2.15" className="fill-primary"/>
            </svg>
            {mark ? null : (
                <span className="font-sans text-[1.15rem] leading-none font-bold tracking-[-0.4em]">
                    Lumina
                    <span className="text-primary">.</span>
                </span>
            )}
        </Link>
    )
}