/* useEngagement — looks up engagement by URL param.
   For V1 demo: if engagementId is "demo" and no engagement exists, create one. */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";

export function useEngagement() {
  const { engagementId } = useParams();
  const [engagement, setEngagement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // For the "demo" alias, look up the first engagement OR create one
        if (engagementId === "demo") {
          const all = await api.listEngagements();
          let eng;
          if (all.length > 0) {
            eng = all[0];
          } else {
            eng = await api.createEngagement({
              client_name: "Demo Steel Mill",
              industry: "steel",
              sub_segment: "integrated_steel_mill_multi_plant",
              plants: ["Jamshedpur", "Kalinganagar", "Angul", "Bhilai", "Dolvi", "Visakhapatnam"],
              annual_spend_inr_cr: 5000,
              fte_count: 80,
            });
          }
          if (!cancelled) setEngagement(eng);
        } else {
          const eng = await api.getEngagement(engagementId);
          if (!cancelled) setEngagement(eng);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [engagementId]);

  return { engagement, loading, error };
}
