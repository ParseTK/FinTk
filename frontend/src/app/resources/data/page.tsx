import type { Metadata } from "next";
import { ResourcePlaceholder, areaById } from "@/features/resources";

const area = areaById("data");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default function DataPage() {
  return <ResourcePlaceholder area="data" />;
}
