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
          setError("No data uploaded yet. Go to Stage 4 (Data Upload) and load a sample or upload your own files.");
          setLoading(false); return;
        }
        // Intel pipeline operates on the PO file.
        const poUpload = uploads.find((u) => u.file_type === "PO");
        if (!poUpload) {
          setError("No PO Dump uploaded. Go to Stage 4 (Data Upload) and load the PO sample (or upload your own PO file).");
          setLoading(false); return;
        }
        const r = await api.runIntel(engagement.id, poUpload.id, engagement.industry);
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
