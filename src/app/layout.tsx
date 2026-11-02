import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { DueNotifier, ServiceWorkerRegistrar } from "@/components/pwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "What did you do",
  description: "この時間に何をしていたかを振り返る作業記録アプリ",
  applicationName: "What did you do",
  appleWebApp: { capable: true, title: "WDYD", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 pt-[env(safe-area-inset-top)] dark:border-zinc-800">
          <p className="mx-auto max-w-xl px-4 py-2.5 font-bold">What did you do</p>
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 pb-24">{children}</main>
        <Nav />
        <ServiceWorkerRegistrar />
        <DueNotifier />
      </body>
    </html>
  );
}
