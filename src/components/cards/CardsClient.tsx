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

// ─── Panel inner content (shared by desktop sidebar + mobile overlay) ─────────

function CardPanelContent({
  def,
  userCard,
  onClose,
  cardSize,
}: {
  def: CardDefinition;
  userCard: UserCardRow | null;
  onClose: () => void;
  cardSize: { w: number; h: number };
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Close bar */}
      <div style={{
        padding: "0.9rem 1.5rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${RULE}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(10,10,10,0.35)",
        }}>
          Card Detail
        </span>
        <button
          onClick={onClose}
          style={{
            fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em",
            color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          CLOSE ×
        </button>
      </div>

      {/* Card artwork */}
      <div style={{
        background: WARM, flexShrink: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: "2.5rem 2rem",
      }}>
        <div style={{ width: cardSize.w, height: cardSize.h }}>
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
          fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(10,10,10,0.35)", marginBottom: 10,
        }}>
          {rk}
        </div>
        <h3 style={{
          fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: INK,
          margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          {def.name}
        </h3>
        <p style={{
          fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em",
          color: INK, lineHeight: 1.8, margin: "0 0 28px",
        }}>
          {def.description}
        </p>

        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
          {isUnlocked ? (
            <>
              <div style={{
                fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "#aaa", marginBottom: 8,
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
                fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em",
                textTransform: "uppercase", color: ORANGE, marginBottom: 10,
              }}>
                How to unlock
              </div>
              <p style={{
                fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.04em",
                color: INK, lineHeight: 1.75, margin: 0,
              }}>
                {def.hint}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Individual card slot ─────────────────────────────────────────────────────

type SlotProps = {
  def: CardDefinition;
  userCard: UserCardRow | null;
  pendingReveal: boolean;
  isSelected: boolean;
  onFlipEnd: (cardId: string) => void;
  onClick: () => void;
};

function CardSlot({ def, userCard, pendingReveal, isSelected, onFlipEnd, onClick }: SlotProps) {
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
      style={{
        perspective: "700px", cursor: "pointer",
        outline: isSelected ? `2px solid ${ORANGE}` : "2px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.15s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
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

// ─── Cards tab (embedded in Insights) ────────────────────────────────────────

const PANEL_WIDTH = 440;
// Card in panel: 360×576 (5:8, double the old 180×288)
const PANEL_CARD = { w: 360, h: 576 };
// Card in mobile overlay: slightly smaller but still generous
const MOBILE_CARD = { w: 260, h: 416 };

export default function CardsClient({ userId }: { userId: string }) {
  const [cards, setCards] = useState<UserCardRow[] | null>(null);
  const [flipping, setFlipping] = useState<Set<string>>(new Set());

  // Two-state panel so the close animation plays before unmounting content
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openPanel(id: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedCardId(id);
    // One frame delay so the content mounts at width:0 before we animate to full width
    setTimeout(() => setPanelVisible(true), 20);
  }

  function closePanel() {
    setPanelVisible(false);
    closeTimerRef.current = setTimeout(() => setSelectedCardId(null), 340);
  }

  function handleCardClick(id: string) {
    if (selectedCardId === id) {
      closePanel();
    } else {
      openPanel(id);
    }
  }

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

  const selectedDef = CARD_DEFINITIONS.find(d => d.id === selectedCardId) ?? null;
  const selectedUserCard = selectedDef ? (unlockedMap.get(selectedDef.id) ?? null) : null;

  return (
    <div style={{ padding: "32px 0 64px" }}>
      <style>{`
        .cards-grid { grid-template-columns: repeat(5, 1fr); }
        @media (max-width: 640px) { .cards-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        /* Desktop sidebar panel */
        .cards-panel-desktop { display: block; }
        .cards-panel-mobile  { display: none; }
        @media (max-width: 767px) {
          .cards-panel-desktop { display: none !important; }
          .cards-panel-mobile  { display: flex !important; }
        }
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

      {/* ── Grid + desktop panel row ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>

        {/* Card grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cards-grid" style={{ display: "grid", gap: 14 }}>
            {CARD_DEFINITIONS.map((def) => (
              <CardSlot
                key={def.id}
                def={def}
                userCard={unlockedMap.get(def.id) ?? null}
                pendingReveal={flipping.has(def.id)}
                isSelected={selectedCardId === def.id}
                onFlipEnd={handleFlipEnd}
                onClick={() => handleCardClick(def.id)}
              />
            ))}
          </div>
        </div>

        {/* Desktop sidebar panel — width animates from 0 → PANEL_WIDTH */}
        <div
          className="cards-panel-desktop"
          style={{
            width: panelVisible ? PANEL_WIDTH : 0,
            flexShrink: 0,
            overflow: "hidden",
            transition: "width 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {selectedDef && (
            <div style={{
              width: PANEL_WIDTH,
              position: "sticky",
              top: 0,
              height: "100vh",
              overflowY: "auto",
              borderLeft: `1px solid ${RULE}`,
              background: "#ffffff",
            }}>
              <CardPanelContent
                def={selectedDef}
                userCard={selectedUserCard}
                onClose={closePanel}
                cardSize={PANEL_CARD}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay panel — full-screen fixed */}
      {selectedDef && (
        <>
          <div
            onClick={closePanel}
            className="cards-panel-mobile"
            style={{
              position: "fixed", inset: 0,
              background: "rgba(10,10,10,0.22)",
              zIndex: 90,
              display: "none", // overridden to flex by media query
            }}
          />
          <div
            className="cards-panel-mobile"
            style={{
              position: "fixed", top: 0, right: 0,
              width: "100vw", height: "100dvh",
              background: "#ffffff",
              zIndex: 100,
              overflowY: "auto",
              display: "none", // overridden to flex by media query
              flexDirection: "column",
            }}
          >
            <CardPanelContent
              def={selectedDef}
              userCard={selectedUserCard}
              onClose={closePanel}
              cardSize={MOBILE_CARD}
            />
          </div>
        </>
      )}
    </div>
  );
}
