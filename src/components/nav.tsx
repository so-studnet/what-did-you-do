"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/templates", label: "テンプレート" },
  { href: "/tags", label: "タグ" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-background/90 backdrop-blur dark:border-zinc-800">
      <nav className="mx-auto flex w-full max-w-xl items-center gap-1 px-4 py-2">
        <span className="mr-auto font-bold">What did you do</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? "page" : undefined}
            className={`rounded-lg px-2.5 py-1.5 text-sm ${
              pathname === l.href ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
