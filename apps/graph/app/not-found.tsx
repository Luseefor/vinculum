import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6">
      <div className="panel w-full max-w-md p-6 text-center">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Page not found</h1>
        <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Go to landing page
          </Link>
          <Link href="/editor" className="btn btn-secondary">
            Open editor
          </Link>
        </div>
      </div>
    </div>
  );
}
