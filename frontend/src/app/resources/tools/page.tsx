import type { Metadata } from "next";
import { ResearchTools, areaById, parseCompare } from "@/features/resources";

const area = areaById("tools");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ compare?: string | string[] }>;
}) {
  const { compare } = await searchParams;
  return <ResearchTools compare={parseCompare(compare)} />;
}
