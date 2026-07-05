"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CARD_DEFINITIONS, type CardDefinition } from "@/lib/cards/definitions";
import { createClient } from "@/lib/supabase/client";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const WARM   = "#FDF6F0";


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
      <span style={{
        fontFamily: SERIF, fontWeight: 700,
        fontSize: 30,
        color: ORANGE, lineHeight: 1,
      }}>
        ō
      </span>
      {def && (
        <>
          <span style={{
            fontFamily: MONO, fontSize: 10,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: INK, textAlign: "center",
            lineHeight: 1.35, marginTop: 2,
          }}>
            {def.name}
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 8,
            letterSpacing: "0.12em",
            color: "rgba(10,10,10,0.38)",
          }}>
            {`RK-${String(def.number).padStart(3, "0")}`}
          </span>
          {def.hint && (
            <>
              <div style={{ width: "60%", height: "1px", background: RULE, margin: "5px 0 3px" }} />
              <span style={{
                fontFamily: MONO, fontSize: 7,
                letterSpacing: "0.05em",
                color: "rgba(10,10,10,0.32)",
                textAlign: "center",
                lineHeight: 1.55,
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

// ─── Detail panel (right drawer) ─────────────────────────────────────────────

function CardPanel({
  def,
  userCard,
  onClose,
}: {
  def: CardDefinition;
  userCard: UserCardRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const isUnlocked = !!userCard;
  const rk = `RK-${String(def.number).padStart(3, "0")}`;
  const formattedDate = userCard?.unlocked_at
    ? new Date(userCard.unlocked_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(10,10,10,0.22)",
          zIndex: 90,
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed",
        top: 0, right: 0,
        width: "min(400px, 100vw)",
        height: "100dvh",
        background: "#ffffff",
        borderLeft: `1px solid ${RULE}`,
        boxShadow: "-12px 0 40px rgba(10,10,10,0.1)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Close bar */}
        <div style={{
          padding: "0.9rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${RULE}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.35)" }}>
            Card Detail
          </span>
          <button
            onClick={onClose}
            style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em",
              color: "#aaa", background: "none", border: "none",
              cursor: "pointer", padding: 0,
            }}
          >
            CLOSE ×
          </button>
        </div>

        {/* Card artwork */}
        <div style={{
          background: WARM,
          padding: "2.5rem 2rem",
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {/* 5:8 ratio at 180px wide → 288px tall */}
          <div style={{ width: 180, height: 288 }}>
            {isUnlocked ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={def.image}
                alt={def.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <CardBack def={def} />
            )}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: "2rem 2rem 2.5rem", flex: 1 }}>
          <div style={{
            fontFamily: MONO, fontSize: 8,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(10,10,10,0.35)",
            marginBottom: 10,
          }}>
            {rk}
          </div>
          <h3 style={{
            fontFamily: SERIF, fontSize: 26,
            fontWeight: 400, color: INK,
            margin: "0 0 16px",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}>
            {def.name}
          </h3>
          <p style={{
            fontFamily: MONO,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            color: INK,
            lineHeight: 1.8,
            margin: "0 0 28px",
          }}>
            {def.description}
          </p>

          <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
            {isUnlocked ? (
              <>
                <div style={{
                  fontFamily: MONO, fontSize: 8,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "#aaa", marginBottom: 8,
                }}>
                  Unlocked
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 16, color: INK, letterSpacing: "-0.01em" }}>
                  {formattedDate}
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: MONO, fontSize: 8,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: ORANGE, marginBottom: 10,
                }}>
                  How to unlock
                </div>
                <p style={{
                  fontFamily: MONO,
                  fontSize: "0.72rem",
                  letterSpacing: "0.04em",
                  color: INK,
                  lineHeight: 1.75,
                  margin: 0,
                }}>
                  {def.hint}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Individual card slot ─────────────────────────────────────────────────────

type SlotProps = {
  def: CardDefinition;
  userCard: UserCardRow | null;
  pendingReveal: boolean;
  onFlipEnd: (cardId: string) => void;
  onClick: () => void;
};

function CardSlot({ def, userCard, pendingReveal, onFlipEnd, onClick }: SlotProps) {
  const [hovered, setHovered] = useState(false);
  const didFlipRef = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);

  // Set initial back position via DOM so React never owns the transform prop.
  // This prevents React re-renders from overriding our direct manipulation below.
  useEffect(() => {
    const el = innerRef.current;
    if (el) el.style.transform = "rotateY(180deg)";
  }, []); // mount only

  // When data arrives and this card is already revealed, jump straight to front.
  useEffect(() => {
    if (!userCard?.revealed_at) return;
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "rotateY(0deg)";
  }, [userCard?.revealed_at]);

  // Play the flip animation using direct DOM manipulation.
  // React-state-driven CSS transitions are unreliable in React 18 concurrent mode
  // because React can batch/defer commits, meaning the browser may never observe
  // the 180deg starting position before the 0deg target is committed.
  // offsetHeight forces a synchronous reflow that guarantees the starting position
  // is committed before the transition begins.
  useEffect(() => {
    if (!pendingReveal || didFlipRef.current) return;
    didFlipRef.current = true;

    const el = innerRef.current;
    if (!el) return;

    // Commit back position with no transition, then force reflow.
    el.style.transition = "none";
    el.style.transform = "rotateY(180deg)";
    void el.offsetHeight; // ← synchronous reflow; browser commits 180deg here

    // Now start the animated flip to front.
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
      style={{ perspective: "700px", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        ref={innerRef}
        style={{
          position: "relative",
          aspectRatio: "5 / 8",
          transformStyle: "preserve-3d",
          // transform intentionally absent — owned entirely by the ref effects above
        }}
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
              {hovered && formattedDate && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(10,10,10,0.62)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 6,
                }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 9,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.45)",
                  }}>
                    Unlocked
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 11,
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
          <CardBack def={def} />
        </div>
      </div>
    </div>
  );
}

// ─── Cards tab (embedded in Insights) ────────────────────────────────────────

export default function CardsClient({ userId }: { userId: string }) {
  const [cards, setCards] = useState<UserCardRow[] | null>(null);
  const [flipping, setFlipping] = useState<Set<string>>(new Set());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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
  const total = CARD_DEFINITIONS.length;

  const selectedDef = CARD_DEFINITIONS.find(d => d.id === selectedCardId) ?? null;
  const selectedUserCard = selectedDef ? (unlockedMap.get(selectedDef.id) ?? null) : null;

  return (
    <div style={{ padding: "32px 0 64px" }}>
      <style>{`
        .cards-grid { grid-template-columns: repeat(5, 1fr); }
        @media (max-width: 640px) { .cards-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>

      {/* ── Luxury counter ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        marginBottom: 40,
        gap: 20,
      }}>
        <div style={{ flex: 1, height: "1px", background: RULE, alignSelf: "center" }} />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            justifyContent: "flex-end",
            lineHeight: 1,
          }}>
            <span style={{
              fontFamily: SERIF, fontSize: 56,
              fontWeight: 400, color: INK, lineHeight: 1,
            }}>
              {cards === null ? "—" : unlockedCount}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 15,
              letterSpacing: "0.04em",
              color: "rgba(10,10,10,0.3)",
            }}>
              / {total}
            </span>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 8,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "rgba(10,10,10,0.32)",
            marginTop: 4,
          }}>
            collected
          </div>
        </div>
      </div>

      {/* ── 22-slot grid ── */}
      <div className="cards-grid" style={{ display: "grid", gap: 14 }}>
        {CARD_DEFINITIONS.map((def) => (
          <CardSlot
            key={def.id}
            def={def}
            userCard={unlockedMap.get(def.id) ?? null}
            pendingReveal={flipping.has(def.id)}
            onFlipEnd={handleFlipEnd}
            onClick={() => setSelectedCardId(def.id)}
          />
        ))}
      </div>

      {/* ── Detail panel ── */}
      {selectedDef && (
        <CardPanel
          def={selectedDef}
          userCard={selectedUserCard}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}
