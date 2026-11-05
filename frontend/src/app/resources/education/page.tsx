import type { Metadata } from "next";
import { ResourcePlaceholder, areaById } from "@/features/resources";

const area = areaById("education");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default function EducationPage() {
  return <ResourcePlaceholder area="education" />;
}
