import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vinculum",
  description: "Interactive 3D mathematical visualization and 2D sketching editor.",
  applicationName: "Vinculum",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Vinculum",
    description: "Interactive 3D mathematical visualization and 2D sketching editor.",
    type: "website",
    images: ["/og-image.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Vinculum",
    description: "Interactive 3D mathematical visualization and 2D sketching editor.",
    images: ["/og-image.png"]
  },
  icons: {
    icon: "/brand/logo_only.png",
    apple: "/brand/logo_only.png"
  }
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
