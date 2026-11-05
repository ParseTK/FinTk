import type { Metadata } from "next";
import { ResearchTools, areaById } from "@/features/resources";

const area = areaById("tools");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default function ToolsPage() {
  return <ResearchTools />;
}
