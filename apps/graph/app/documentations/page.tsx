import type { Metadata } from "next";
import DocumentationClientPage from "@/components/documentation/DocumentationClientPage";

export const metadata: Metadata = {
  title: "Vinculum Documentation",
  description: "Learn to graph expressions, analyze fields, follow worked solutions, and save or share scenes in Vinculum."
};

export default function DocumentationsPage() {
  return <DocumentationClientPage />;
}
