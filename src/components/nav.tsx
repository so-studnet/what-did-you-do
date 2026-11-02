"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ホーム", icon: "▶" },
  { href: "/timeline", label: "タイムライン", icon: "☰" },
  { href: "/summary", label: "集計", icon: "▤" },
  { href: "/templates", label: "テンプレ", icon: "★" },
  { href: "/tags", label: "タグ", icon: "#" },
];

/** 画面下部に固定するタブバー */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  active ? "font-bold text-blue-600" : "text-zinc-500"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {l.icon}
                </span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
