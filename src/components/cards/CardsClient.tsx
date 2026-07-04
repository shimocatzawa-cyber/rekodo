"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CARD_DEFINITIONS, type CardDefinition } from "@/lib/cards/definitions";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";

const ROMAN = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII",
];

type UserCardRow = {
  card_id: string;
  unlocked_at: string;
  revealed_at: string | null;
};

// ─── Card back placeholder ────────────────────────────────────────────────────
// NOTE: this is a placeholder — replace with real card-back artwork

function CardBack() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: INK,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
      gap: 5,
      userSelect: "none",
    }}>
      <span style={{
        fontFamily: SERIF, fontWeight: 700,
        fontSize: "clamp(18px, 5cqw, 28px)",
        color: ORANGE, lineHeight: 1,
      }}>
        ō
      </span>
      <span style={{
        fontFamily: MONO, fontSize: "clamp(5px, 1.4cqw, 8px)",
        letterSpacing: "0.22em", color: "rgba(255,255,255,0.2)",
        textTransform: "uppercase",
      }}>
        rekōdo
      </span>
    </div>
  );
}

// ─── Individual card slot ─────────────────────────────────────────────────────

type FaceState = "back" | "flipping" | "front";

type SlotProps = {
  def: CardDefinition;
  userCard: UserCardRow | null;
  pendingReveal: boolean;
  onFlipEnd: (cardId: string) => void;
};

function CardSlot({ def, userCard, pendingReveal, onFlipEnd }: SlotProps) {
  const [faceState, setFaceState] = useState<FaceState>(
    userCard?.revealed_at ? "front" : "back"
  );
  const [hovered, setHovered] = useState(false);
  const didFlipRef = useRef(false);

  useEffect(() => {
    if (!pendingReveal || didFlipRef.current) return;
    didFlipRef.current = true;
    setFaceState("back");
    requestAnimationFrame(() => requestAnimationFrame(() => setFaceState("flipping")));
  }, [pendingReveal]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform" || faceState !== "flipping") return;
      setFaceState("front");
      onFlipEnd(def.id);
    },
    [faceState, def.id, onFlipEnd]
  );

  const rotateY  = faceState === "back" ? "180deg" : "0deg";
  const animated = faceState === "flipping";

  const formattedDate = userCard?.unlocked_at
    ? new Date(userCard.unlocked_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <div
      style={{ perspective: "700px", containerType: "inline-size" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "5 / 7",
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotateY})`,
          transition: animated ? "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* ── Front face ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          overflow: "hidden",
        }}>
          {userCard ? (
            <div style={{ position: "relative", width: "100%", height: "100%", background: "#111" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={def.image}
                alt={def.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "24px 10px 10px",
                background: "linear-gradient(to bottom, transparent, rgba(10,10,10,0.78))",
              }}>
                <div style={{
                  fontFamily: MONO, fontSize: "clamp(6px, 1.6cqw, 8px)",
                  letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)",
                  marginBottom: 3,
                }}>
                  {ROMAN[def.number]}
                </div>
                <div style={{
                  fontFamily: SERIF, fontSize: "clamp(10px, 2.8cqw, 13px)",
                  color: "#ffffff", lineHeight: 1.2,
                }}>
                  {def.name}
                </div>
              </div>
              {hovered && formattedDate && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(10,10,10,0.62)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 6,
                }}>
                  <div style={{
                    fontFamily: MONO, fontSize: "clamp(7px, 1.8cqw, 9px)",
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.45)",
                  }}>
                    Unlocked
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: "clamp(9px, 2.5cqw, 12px)",
                    color: "#ffffff", letterSpacing: "0.06em",
                  }}>
                    {formattedDate}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <CardBack />
          )}
        </div>

        {/* ── Back face ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}>
          <CardBack />
        </div>
      </div>
    </div>
  );
}

// ─── Cards tab (embedded in Insights) ────────────────────────────────────────

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

  // Trigger state-based evaluation on mount (fire-and-forget)
  useEffect(() => {
    fetch("/api/cards/evaluate", { method: "POST" }).catch(() => {});
  }, []);

  // Realtime: new card unlocked while on page
  // Requires: Supabase Dashboard → Database → Replication → user_cards → enable
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
    setFlipping(prev => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
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

  return (
    <div style={{ padding: "32px 0 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{
          fontFamily: SERIF, fontWeight: 400, fontSize: 24,
          margin: "0 0 12px", lineHeight: 1.1, color: INK,
        }}>
          {cards === null ? "—" : unlockedCount} of 22 revealed
        </h2>
        <div style={{ width: 32, height: 1, background: RULE }} />
      </div>

      {/* 22-slot grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 16,
      }}>
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
