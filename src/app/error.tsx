"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-black">
      <div className="text-center px-6">
        <p className="text-sm uppercase tracking-wide text-black/50 mb-2">rekōdo</p>
        <h1 className="text-2xl font-medium mb-4">Something went wrong.</h1>
        <button className="underline" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
