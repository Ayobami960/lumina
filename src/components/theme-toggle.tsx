
"use client";

import { MonitorActivity, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  useId,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

function revealTheme(apply: () => void) {
  const reduce = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (
    reduce ||
    typeof document.startViewTransition !== "function"
  ) {
    apply();
    return;
  }

  const transition = document.startViewTransition(() => {
    apply();
  });

  transition.ready.then(() => {
    const radius = Math.hypot(
      window.innerWidth,
      window.innerHeight
    );

    document.documentElement.animate(
      [
        { clipPath: "circle(0px at 50% 50%)" },
        { clipPath: `circle(${radius}px at 50% 50%)` },
      ],
      {
        duration: 700,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        pseudoElement: "::view-transition-new(root)",
        fill: "both",
      }
    );
  });
}

export function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );

  const dark = ready && resolvedTheme === "dark";

  function choose(next: "light" | "dark") {
    revealTheme(() => setTheme(next));
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={dark ? "Use light theme" : "Use dark theme"}
        aria-pressed={dark}
        onClick={() => choose(dark ? "light" : "dark")}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ClassicIcon />
      </button>
    );
  }

  return (
    <div
      className="flex h-10 items-center rounded-full bg-muted p-1"
      role="group"
      aria-label="Color theme"
    >
      <ThemeChoice
        label="Light"
        pressed={ready && !dark}
        onClick={() => choose("light")}
      >
        <Sun className="size-3.5" />
      </ThemeChoice>

      <ThemeChoice
        label="Dark"
        pressed={dark}
        onClick={() => choose("dark")}
      >
        <MonitorActivity className="size-3.5" />
      </ThemeChoice>
    </div>
  );
}

function ClassicIcon() {
  const clipId = `classic-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      style={
        {
          "--toggle-dot-duration": "400ms",
        } as CSSProperties
      }
    >
      <defs>
        <clipPath id={clipId}>
          <path
            d="M0 0h13a1 1 0 0010 10v14H0Z"
            className="motion-safe:transition-all motion-safe:duration-(--toggle-dot-duration) dark:[d:path('M0_2h13a1_1_0_0010_10v14H0Z')]"
          />
        </clipPath>
      </defs>

      <g
        stroke="currentColor"
        strokeLinecap="round"
      >
        <circle
          cx="12"
          cy="12"
          r="5"
          fill="currentColor"
          clipPath={`url(#${clipId})`}
          className="origin-center motion-safe:transition-transform motion-safe:duration-(--toggle-dot-duration) dark:scale-[1.7]"
        />

        {[
          "M12 1.4v2.4",
          "m20.3 3.7-2.5 2.5",
          "M22.6 12h-2.4",
          "M12 22.6v-2.4",
          "M1.4 12h2.4",
          "m20.3 20.3-2.5-2.5",
          "m3.7 20.3 2.5-2.5",
          "m3.7 3.7 2.5 2.5",
        ].map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            strokeLinejoin="round"
            className="origin-center motion-safe:transition-opacity motion-safe:duration-(--toggle-dot-duration) dark:scale-0 dark:opacity-0"
          />
        ))}
      </g>
    </svg>
  );
}

function ThemeChoice({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full transition",
        pressed
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
