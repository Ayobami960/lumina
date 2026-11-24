
import type { Metadata } from "next";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// JSON.stringify leaves "<" unchanged. Escape it to prevent
// a string containing "</script>" from closing a script tag.
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noIndex?: boolean;
  absolute?: boolean;
  type?: "website" | "article" | "book" | "profile";
};

export function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex = false,
  absolute = false,
  type = "website",
}: PageMetadataOptions): Metadata {
  const baseUrl = siteUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const images = image
    ? [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ]
    : undefined;

  return {
    title: absolute ? { absolute: title } : title,
    description,

    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": [
          {
            url: `${baseUrl}/feed-xml`,
            title: "Lumina",
          },
        ],
      },
    },

    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },

    openGraph: {
      title,
      description,
      url,
      type,
      siteName: "Lumina",
      ...(images ? { images } : {}),
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images: images.map((item) => item.url) } : {}),
    },
  };
}
