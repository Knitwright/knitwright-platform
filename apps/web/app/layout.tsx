import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { NavigationProgress } from "@/components/shell/NavigationProgress";
import { ToastProvider } from "@/components/ui/Toast";
import { PRODUCT } from "@/lib/config/product";
import "./globals.css";

/** The interface font (docs/spec/10-design-system.md §3), self-hosted by next/font at build time. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT.name} | ${PRODUCT.tagline}`,
    template: `%s | ${PRODUCT.name}`,
  },
  description:
    "Describe a garment or upload a sketch. Get a tech pack a factory can build from.",
};

/** Light theme only: the build pack has no dark mode (decision 0137). */
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="relative isolate flex min-h-full flex-col">
        <NavigationProgress />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface-solid focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
