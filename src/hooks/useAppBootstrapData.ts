import { useEffect, useState } from "react";
import * as api from "../api";
import type { UpdateStatus } from "../api";

/**
 * Handles app session bootstrap and update-status polling.
 * Extracted from App.tsx to reduce component complexity.
 */
export function useAppBootstrapData(fetchAll: () => void) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  // Session bootstrap → initial data load
  useEffect(() => {
    api.bootstrapSession().finally(() => {
      fetchAll();
    });
  }, [fetchAll]);

  // Update status polling (every 30 min)
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      api
        .getUpdateStatus()
        .then((s) => {
          if (!cancelled) setUpdateStatus(s);
        })
        .catch(() => {});
    refresh();
    const t = setInterval(refresh, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return { updateStatus, setUpdateStatus };
}
