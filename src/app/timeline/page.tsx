import type { Metadata } from "next";
import { TimelineView } from "@/components/timeline-view";

export const metadata: Metadata = { title: "タイムライン | What did you do" };

export default function TimelinePage() {
  return (
    <>
      <h1 className="text-xl font-bold">タイムライン</h1>
      <TimelineView />
    </>
  );
}
