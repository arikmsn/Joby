"use client";

import { useEffect, useState, useCallback } from "react";
import type { OccupationOption } from "@/components/ui/occupation-picker";

export function useOccupations() {
  const [occupations, setOccupations] = useState<OccupationOption[]>([]);

  useEffect(() => {
    fetch("/api/occupations")
      .then((res) => res.json())
      .then((data) => setOccupations(data.occupations || []))
      .catch(() => setOccupations([]));
  }, []);

  const occupationLabel = useCallback(
    (key: string) => occupations.find((o) => o.key === key)?.label_he || key,
    [occupations]
  );

  return { occupations, occupationLabel };
}
