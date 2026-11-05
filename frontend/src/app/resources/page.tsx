import type { Metadata } from "next";
import { ResourcesOverview } from "@/features/resources";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Learn the concepts, find the original material, and understand the figures behind Virello.",
};

export default function ResourcesPage() {
  return <ResourcesOverview />;
}
