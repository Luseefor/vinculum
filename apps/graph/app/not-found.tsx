import Link from "next/link";
import PublicPageShell from "@/components/layout/PublicPageShell";

export default function NotFound() {
  return <PublicPageShell><section className="public-container public-recovery">
    <p className="public-eyebrow">Page not found</p><h1>Let’s get you back.</h1>
    <p className="public-lead">This address doesn’t lead to a page. Open the editor or visit the guide to get started.</p>
    <div className="public-cta"><Link href="/editor" className="public-button public-button-primary">Open editor</Link><Link href="/documentations" className="public-button public-button-secondary">Read the guide</Link></div>
  </section></PublicPageShell>;
}
