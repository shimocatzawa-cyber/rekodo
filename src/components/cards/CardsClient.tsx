"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CARD_DEFINITIONS, type CardDefinition } from "@/lib/cards/definitions";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";

type UserCardRow = {
  card_id: string;
  unlocked_at: string;
  revealed_at: string | null;
};

// ─── Card back / locked face ──────────────────────────────────────────────────

function CardBack({ def }: { def?: CardDefinition }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#ffffff",
      border: "1.5px solid " + INK,
      boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
      gap: def ? 4 : 0,
      padding: "0 10px",
      userSelect: "none",
    }}>
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 30, color: ORANGE, lineHeight: 1 }}>
        ō
      </span>
      {def && (
        <>
          <span style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
            color: INK, textAlign: "center", lineHeight: 1.35, marginTop: 2,
          }}>
            {def.name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", color: "rgba(10,10,10,0.38)" }}>
            {`RK-${String(def.number).padStart(3, "0")}`}
          </span>
          {def.hint && (
            <>
              <div style={{ width: "60%", height: "1px", background: RULE, margin: "5px 0 3px" }} />
              <span style={{
                fontFamily: MONO, fontSize: 7, letterSpacing: "0.05em",
                color: "rgba(10,10,10,0.32)", textAlign: "center", lineHeight: 1.55,
              }}>
                {def.hint}
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Individual card slot ─────────────────────────────────────────────────────

type SlotProps = {
  def: CardDefinition;
  userCard: UserCardRow | null;
  pendingReveal: boolean;
  onFlipEnd: (cardId: string) => void;
};

function CardSlot({ def, userCard, pendingReveal, onFlipEnd }: SlotProps) {
  const [hovered, setHovered] = useState(false);
  const didFlipRef = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (el) el.style.transform = "rotateY(180deg)";
  }, []);

  useEffect(() => {
    if (!userCard?.revealed_at) return;
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "rotateY(0deg)";
  }, [userCard?.revealed_at]);

  useEffect(() => {
    if (!pendingReveal || didFlipRef.current) return;
    didFlipRef.current = true;
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "rotateY(180deg)";
    void el.offsetHeight;
    el.style.transition = "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)";
    el.style.transform = "rotateY(0deg)";
    const handleEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      el.removeEventListener("transitionend", handleEnd);
      el.style.transition = "";
      onFlipEnd(def.id);
    };
    el.addEventListener("transitionend", handleEnd);
    return () => el.removeEventListener("transitionend", handleEnd);
  }, [pendingReveal, def.id, onFlipEnd]);

  const formattedDate = userCard?.unlocked_at
    ? new Date(userCard.unlocked_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <div
      style={{ perspective: "700px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={innerRef}
        style={{ position: "relative", aspectRatio: "5 / 8", transformStyle: "preserve-3d" }}
      >
        {/* Front face */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden",
        }}>
          {userCard ? (
            <div style={{ position: "relative", width: "100%", height: "100%", background: "#111" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={def.image} alt={def.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {hovered && formattedDate && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(10,10,10,0.62)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 6,
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
                    Unlocked
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: "#ffffff", letterSpacing: "0.06em" }}>
                    {formattedDate}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <CardBack />
          )}
        </div>

        {/* Back face */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}>
          <CardBack def={def} />
        </div>
      </div>
    </div>
  );
}

// ─── Cards tab ────────────────────────────────────────────────────────────────

export default function CardsClient({ userId }: { userId: string }) {
  const [cards, setCards] = useState<UserCardRow[] | null>(null);
  const [flipping, setFlipping] = useState<Set<string>>(new Set());

  // Fetch user's cards on mount
  useEffect(() => {
    const supabase = createClient();
    (supabase as any)
      .from("user_cards")
      .select("card_id, unlocked_at, revealed_at")
      .eq("user_id", userId)
      .then(({ data }: { data: UserCardRow[] | null }) => {
        const rows = data ?? [];
        setCards(rows);
        const pending = rows.filter(c => c.unlocked_at && !c.revealed_at);
        pending.forEach((card, i) => {
          setTimeout(() => {
            setFlipping(prev => new Set([...prev, card.card_id]));
          }, i * 900 + 600);
        });
      });
  }, [userId]);

  useEffect(() => {
    fetch("/api/cards/evaluate", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("user-cards-inserts")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "user_cards", filter: `user_id=eq.${userId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const newCard = payload.new as UserCardRow;
          setCards(prev => {
            if (!prev || prev.some(c => c.card_id === newCard.card_id)) return prev;
            return [...prev, newCard];
          });
          setTimeout(() => {
            setFlipping(prev => new Set([...prev, newCard.card_id]));
          }, 400);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleFlipEnd = useCallback((cardId: string) => {
    setFlipping(prev => { const n = new Set(prev); n.delete(cardId); return n; });
    setCards(prev =>
      prev ? prev.map(c => c.card_id === cardId ? { ...c, revealed_at: new Date().toISOString() } : c) : prev
    );
    fetch("/api/cards/reveal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: cardId }),
    }).catch(() => {});
  }, []);

  const unlockedMap = new Map((cards ?? []).map(c => [c.card_id, c]));
  const unlockedCount = cards?.length ?? 0;
  const total = CARD_DEFINITIONS.length;

  return (
    <div style={{ padding: "32px 0 64px" }}>
      <style>{`
        .cards-grid { grid-template-columns: repeat(5, 1fr); }
        @media (max-width: 640px) { .cards-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>

      {/* ── Luxury counter ── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
        marginBottom: 40, gap: 20,
      }}>
        <div style={{ flex: 1, height: "1px", background: RULE, alignSelf: "center" }} />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", lineHeight: 1 }}>
            <span style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 400, color: INK, lineHeight: 1 }}>
              {cards === null ? "—" : unlockedCount}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.04em", color: "rgba(10,10,10,0.3)" }}>
              / {total}
            </span>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "rgba(10,10,10,0.32)", marginTop: 4,
          }}>
            collected
          </div>
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="cards-grid" style={{ display: "grid", gap: 14 }}>
        {CARD_DEFINITIONS.map((def) => (
          <CardSlot
            key={def.id}
            def={def}
            userCard={unlockedMap.get(def.id) ?? null}
            pendingReveal={flipping.has(def.id)}
            onFlipEnd={handleFlipEnd}
          />
        ))}
      </div>
    </div>
  );
}
