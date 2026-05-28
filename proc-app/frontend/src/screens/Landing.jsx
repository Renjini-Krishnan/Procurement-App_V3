import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Badge } from "../design/components.jsx";
import { Logo } from "../design/Logo.jsx";
import { I } from "../design/icons.jsx";
import { api } from "../api/client.js";
import { STAGES } from "../data/stages.js";

/* Landing — adapted from /tmp/design_system/ds-screens.jsx LandingScreen.
   Indigo direction; hero "Run a maturity assessment in DAYS, not weeks." */

const Landing = () => {
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listEngagements();
        setEngagements(list);
      } catch {
        setEngagements([]);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const resume = () => {
    if (engagements.length > 0) {
      const e = engagements[0];
      const stage = STAGES.find((s) => s.id === e.current_stage_id) || STAGES.find((s) => s.slug === "upload");
      navigate(`/engagement/${e.id}/${stage.slug}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", padding: 32 }}>
      <div
        style={{
          minHeight: 600,
          background: "var(--surface-hero)",
          color: "white",
          borderRadius: "var(--r-2xl)",
          overflow: "hidden",
          position: "relative",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {/* faint grid lines */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.1))",
          }}
        />

        {/* top bar */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "22px 32px" }}>
          <Logo inverted />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: "var(--fs-13)", opacity: 0.7 }}>
              {engagements.length} engagement{engagements.length === 1 ? "" : "s"}
            </span>
            <Button variant="outline" size="sm"
                    style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                    onClick={() => navigate("/kb")}>
              KB editor
            </Button>
            <Button variant="outline" size="sm"
                    style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                    disabled={engagements.length === 0} onClick={resume}>
              Resume engagement
            </Button>
          </div>
        </div>

        {/* hero grid */}
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 32,
            padding: "60px 32px 80px",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--fs-12)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.7,
                marginBottom: 24,
              }}
            >
              Procurement Functional Assessment
            </div>
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(40px, 5.5vw, 76px)",
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
                fontWeight: 600,
                margin: 0,
                maxWidth: "14ch",
              }}
            >
              Run a maturity assessment in{" "}
              <em
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontWeight: 500,
                }}
              >
                days
              </em>
              , not weeks.
            </h1>
            <p
              style={{
                fontSize: "var(--fs-18)",
                lineHeight: 1.5,
                opacity: 0.78,
                marginTop: 22,
                maxWidth: "54ch",
              }}
            >
              Upload PO data, org structure, and QRE responses. Procvault grounds every
              finding in industry benchmarks, cites every source, and produces a
              defensible findings deck.
            </p>

            <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button
                size="lg"
                iconRight={<I.Arrow size={16} />}
                style={{ background: "white", color: "var(--ink-900)", border: "1px solid white" }}
                onClick={() => navigate("/engagement/new")}
              >
                Start new engagement
              </Button>
              <Button
                variant="outline"
                size="lg"
                style={{ color: "white", borderColor: "rgba(255,255,255,0.4)" }}
                disabled={engagements.length === 0}
                onClick={resume}
              >
                Resume last session
              </Button>
            </div>
          </div>

          {/* Right-side illustrative card */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "var(--r-xl)",
                padding: 24,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6 }}>
                Sample finding
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--fs-24)",
                  lineHeight: 1.3,
                  marginTop: 12,
                  marginBottom: 16,
                }}
              >
                "Refractories run as three local buys, not one strategic category."
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <Stat label="Categories flagged" value="14" />
                <Stat label="Structural prize" value="₹130–242 Cr" />
                <Stat label="Industries supported" value="Steel" />
                <Stat label="Sources cited" value="100%" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* engagement list */}
      {!loadingList && engagements.length > 0 && (
        <div style={{ maxWidth: 1200, margin: "48px auto 0 auto" }}>
          <EngagementList engagements={engagements} navigate={navigate} />
        </div>
      )}

      {/* below-hero placeholder for principles / how-it-works */}
      <div style={{ maxWidth: 1200, margin: "48px auto" }}>
        <Principles />
      </div>
    </div>
  );
};

const EngagementList = ({ engagements, navigate }) => (
  <div>
    <div style={{ fontSize: "var(--fs-12)", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-500)", marginBottom: 16 }}>
      Your engagements
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {engagements.map((e) => {
        const stage = STAGES.find((s) => s.id === e.current_stage_id);
        return (
          <Card key={e.id} padding={20} style={{ cursor: "pointer" }}
                onClick={() => navigate(`/engagement/${e.id}/${stage?.slug || "upload"}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: "var(--fs-16)", fontWeight: 600, color: "var(--ink-900)" }}>
                {e.client_name}
              </div>
              <Badge tone="brand">{e.industry}</Badge>
            </div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-500)", marginBottom: 12 }}>
              {e.sub_segment?.replace(/_/g, " ") || "—"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--fs-12)", color: "var(--ink-600)" }}>
              <div><span style={{ color: "var(--ink-500)" }}>Spend</span><br/>₹{e.annual_spend_inr_cr || "—"} Cr</div>
              <div><span style={{ color: "var(--ink-500)" }}>FTEs</span><br/>{e.fte_count || "—"}</div>
              <div style={{ gridColumn: "span 2", marginTop: 6 }}>
                <span style={{ color: "var(--ink-500)" }}>Current stage</span><br/>
                <span style={{ color: "var(--brand-700)", fontWeight: 500 }}>{stage?.name || `Stage ${e.current_stage_id}`}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  </div>
);

const Stat = ({ label, value }) => (
  <div>
    <div style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6 }}>
      {label}
    </div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-18)", fontWeight: 600, marginTop: 2 }}>
      {value}
    </div>
  </div>
);

const Principles = () => (
  <div>
    <div
      style={{
        fontSize: "var(--fs-12)",
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        color: "var(--ink-500)",
        marginBottom: 16,
      }}
    >
      How Procvault works
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
      {[
        {
          n: "1",
          title: "Grounded",
          body: "Every finding traces to a benchmark source + year + confidence. No vague consulting-speak.",
        },
        {
          n: "2",
          title: "Cascade",
          body: "Function defaults → industry overlays → engagement overrides. Most specific wins.",
        },
        {
          n: "3",
          title: "Defensible",
          body: "Engine reads a knowledge base, not hard-coded logic. Every rule + benchmark is editable.",
        },
      ].map((p) => (
        <div key={p.n}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-13)", color: "var(--brand-600)", marginBottom: 8 }}>
            {p.n}
          </div>
          <h3 style={{ fontSize: "var(--fs-20)", fontWeight: 600, margin: "0 0 8px 0", letterSpacing: "-0.01em" }}>
            {p.title}
          </h3>
          <p style={{ fontSize: "var(--fs-14)", lineHeight: 1.55, color: "var(--ink-600)", margin: 0 }}>
            {p.body}
          </p>
        </div>
      ))}
    </div>
  </div>
);

export default Landing;
