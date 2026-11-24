import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
    remotePatterns: [
      {protocol: "https", hostname: "images.unsplash.com"},
      {protocol: "https", hostname: "*.public.blob.vercel-storage.com"},
      {protocol: "https", hostname: "res.cloudinary.com"},
      {protocol: "https", hostname: "cdn.sanity.io"},
      {protocol: "https", hostname: "images.pexels.com"},
      {protocol: "https", hostname: "images.unsplash.com"},
      {protocol: "https", hostname: "cdn.pixabay.com"},
      {protocol: "https", hostname: "i.yting.com"},
      {protocol: "https", hostname: "media.giphy.com"},
      {protocol: "https", hostname: "i.giphy.com"},
      {protocol: "https", hostname: "lh3.googleusercontent.com"},
      {protocol: "https", hostname: "avatars.githubusercontent.com"}
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
