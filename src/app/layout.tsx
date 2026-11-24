import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});



const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ['latin'],
  display: "swap"
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Lumina", template: "Ks -Lumina"},
  description: "A calmer place for technology. $tories on engineering, design, product, and the tools people actually finish",
  openGraph: {
    siteName: "Lumina",
    type: "website",
    title: "Lumina",
    description: "A  calmer place for technology.",
    
  },
  twitter: {card: "summary_large_image"}
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistMono.variable} ${openSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
        </body>
    </html>
  );
}
