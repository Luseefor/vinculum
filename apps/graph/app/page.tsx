import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vinculum | Interactive 3D Mathematical Visualization",
  description:
    "Build, sketch, measure, share, and export mathematical scenes in one focused workspace."
};

interface HomePageProps {
  searchParams?: {
    scene?: string;
  };
}

export default function HomePage({ searchParams }: HomePageProps) {
  if (typeof searchParams?.scene === "string" && searchParams.scene.length > 0) {
    redirect(`/editor?scene=${encodeURIComponent(searchParams.scene)}`);
  }
  return <LandingPage />;
}
