import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Aurora } from "@/components/shell/Aurora";
import { NavigationProgress } from "@/components/shell/NavigationProgress";
import { PRODUCT } from "@/lib/config/product";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT.name} | ${PRODUCT.tagline}`,
    template: `%s | ${PRODUCT.name}`,
  },
  description:
    "Describe a garment or upload a sketch. Get a tech pack a factory can build from.",
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="relative isolate flex min-h-full flex-col">
        <Aurora />
        <NavigationProgress />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface-solid focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
