import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "設定 | What did you do" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">設定</h1>
      <SettingsView />
    </>
  );
}
