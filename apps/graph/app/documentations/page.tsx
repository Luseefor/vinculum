import type { Metadata } from "next";
import DocumentationClientPage from "@/components/documentation/DocumentationClientPage";

export const metadata: Metadata = {
  title: "Vinculum Documentation",
  description: "System-level documentation for Vinculum architecture, data flow, and reliability model."
};

export default function DocumentationsPage() {
  return <DocumentationClientPage />;
}
