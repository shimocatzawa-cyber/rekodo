"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="text-center px-6">
          <p className="text-sm uppercase tracking-wide text-black/50 mb-2">rekōdo</p>
          <h1 className="text-2xl font-medium mb-4">Something went wrong.</h1>
          <button
            className="underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
