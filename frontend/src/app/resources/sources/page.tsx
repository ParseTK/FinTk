import type { Metadata } from "next";
import { ResourcePlaceholder, areaById } from "@/features/resources";

const area = areaById("sources");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default function SourcesPage() {
  return <ResourcePlaceholder area="sources" />;
}
