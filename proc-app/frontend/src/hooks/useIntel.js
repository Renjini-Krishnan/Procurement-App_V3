/* useIntel — runs Stage 8 + 9 + 10 once on first call and shares result
   across all dependent stage screens. */
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export function useIntel(engagement) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!engagement) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const uploads = await api.listUploads(engagement.id);
        if (uploads.length === 0) {
          setError("No PO data uploaded. Go to Stage 4 first.");
          setLoading(false); return;
        }
        const r = await api.runIntel(engagement.id, uploads[0].id, engagement.industry);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engagement]);

  return { data, loading, error };
}
