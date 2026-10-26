import { notFound } from "next/navigation";
import { DemoScreen } from "./DemoScreen";

// Design preview on made-up data: /preview, /preview?empty, /preview?day,
// /preview?n=3 for a crew of three (for the splash screen).
// Not available in production; the public version lives at /demo.
export default async function Preview({ searchParams }: PageProps<"/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  return <DemoScreen params={await searchParams} />;
}
