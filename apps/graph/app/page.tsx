import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vinculum | 2D & 3D Mathematics",
  description:
    "Build, sketch, measure, share, and export mathematical scenes in one focused workspace."
};

interface HomePageProps {
  searchParams?: Promise<{ scene?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  if (typeof params?.scene === "string" && params.scene.length > 0) {
    redirect(`/editor?scene=${encodeURIComponent(params.scene)}`);
  }
  return <LandingPage />;
}
