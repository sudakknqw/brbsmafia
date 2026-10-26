import type { Metadata } from "next";
import { DemoScreen } from "../preview/DemoScreen";

export const metadata: Metadata = {
  title: "brbs mafia — demo",
  description: "Live demo of brbs mafia on sample data.",
};

// Public demo on made-up data: /demo for the home screen, /demo?day for the day timeline.
// The real app only lets members of the friends' Telegram group in.
export default async function Demo({ searchParams }: PageProps<"/demo">) {
  const params = await searchParams;
  return (
    <>
      <DemoScreen params={params} />
      <p className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-3.5 py-1.5 text-[12px] whitespace-nowrap text-dim">
        Демо на выдуманных данных
      </p>
    </>
  );
}
