import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "AIStaging | AI virtual staging for real estate agents", template: "%s | AIStaging" },
  description:
    "Upload listing photos and get them back furnished, decluttered, lit for dusk and cut into a vertical video.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={schibsted.variable}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-slate focus:px-3 focus:py-2 focus:text-trim"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
