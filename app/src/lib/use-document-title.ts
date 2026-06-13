"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab title for client-rendered pages, mirroring the
 * root layout's "Joby — %s" metadata template (which only applies to
 * server-rendered titles, not client-side `document.title` writes).
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `Joby — ${title}`;
  }, [title]);
}
