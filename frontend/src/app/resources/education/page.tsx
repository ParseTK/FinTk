import type { Metadata } from "next";
import { EducationGuides, areaById } from "@/features/resources";

const area = areaById("education");

export const metadata: Metadata = { title: area.title, description: area.summary };

export default function EducationPage() {
  return <EducationGuides />;
}
