import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const firaCode = Fira_Code({ variable: "--font-fira-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pulltalk — Clarify Code Reviews in 60 Seconds",
  description:
    "Add voice, video, and drawings directly to your GitHub PR comments. Clarify feedback and save time.",
  openGraph: {
    title: "Pulltalk — Clarify Code Reviews in 60 Seconds",
    description:
      "Explain code visually in GitHub PRs using short video comments.",
    url: "https://pulltalk.com",
    siteName: "Pulltalk",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pulltalk — Record and explain code visually",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulltalk — Clarify Code Reviews in 60 Seconds",
    description:
      "Add voice, video, and drawings directly to your GitHub PR comments.",
    images: ["/og-image.png"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${firaCode.variable} antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
