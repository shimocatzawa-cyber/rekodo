"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MONO = "var(--font-mono)";
const RULE = "#e0e0da";

interface Props {
  initialSlots: (string | null)[];
  userId: string;
  isOwner: boolean;
}

export default function CollectionPhotos({ initialSlots, userId, isOwner }: Props) {
  const router = useRouter();
  const [slots,    setSlots]    = useState<(string | null)[]>(initialSlots);
  const [loading,  setLoading]  = useState<boolean[]>([false, false, false]);
  const [hovering, setHovering] = useState<boolean[]>([false, false, false]);

  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const fileRefs = [ref0, ref1, ref2];

  function setSlotHovering(idx: number, val: boolean) {
    setHovering(prev => { const n = [...prev]; n[idx] = val; return n; });
  }

  async function handleUpload(idx: number, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setLoading(prev => { const n = [...prev]; n[idx] = true; return n; });
    const supabase = createClient();
    const storagePath = `${userId}/${idx + 1}.jpg`;


    try {
      const { error: upErr } = await supabase.storage
        .from("collection-photos")
        .upload(storagePath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from("collection-photos")
        .getPublicUrl(storagePath);

      const { error: dbErr } = await supabase
        .from("collection_photos")
        .upsert(
          { user_id: userId, storage_path: storagePath, display_order: idx + 1 },
          { onConflict: "user_id,display_order" }
        );
      if (dbErr) throw dbErr;

      const urlWithBust = `${publicUrl}?v=${Date.now()}`;
      setSlots(prev => { const n = [...prev]; n[idx] = urlWithBust; return n; });
      router.refresh();
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setLoading(prev => { const n = [...prev]; n[idx] = false; return n; });
    }
  }

  async function handleDelete(idx: number) {
    setLoading(prev => { const n = [...prev]; n[idx] = true; return n; });
    const supabase = createClient();
    const storagePath = `${userId}/${idx + 1}.jpg`;


    try {
      await supabase.storage.from("collection-photos").remove([storagePath]);
      await supabase
        .from("collection_photos")
        .delete()
        .eq("user_id", userId)
        .eq("display_order", idx + 1);

      setSlots(prev => { const n = [...prev]; n[idx] = null; return n; });
      setSlotHovering(idx, false);
      router.refresh();
    } catch (err) {
      console.error("Photo delete failed:", err);
    } finally {
      setLoading(prev => { const n = [...prev]; n[idx] = false; return n; });
    }
  }

  const hasAnyPhoto = slots.some(Boolean);
  if (!isOwner && !hasAnyPhoto) return null;

  return (
    <div>
      <p style={{
        fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
        textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px 0",
      }}>
        Your Setup
      </p>
      <div style={{ height: 1, background: RULE, marginBottom: "20px" }} />

      <div className="setup-photos">
        {[0, 1, 2].map(idx => {
          const url       = slots[idx];
          const isLoading = loading[idx];
          const isHover   = hovering[idx];

          if (!url && !isOwner) return null;

          return (
            <div
              key={idx}
              style={{ position: "relative", aspectRatio: "3 / 4" }}
            >
              {/* Frame */}
              <div
                style={{
                  position: "absolute", inset: 0,
                  border: url ? "1px solid #e0e0da" : "1px dashed #e0e0da",
                  padding: url ? "4px" : 0,
                  background: "#ffffff",
                  boxShadow: url ? "3px 3px 0 0 #d0d0c8" : "none",
                  cursor: isOwner ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}
                onClick={() => { if (isOwner && !isLoading) fileRefs[idx].current?.click(); }}
                onMouseEnter={() => { if (isOwner) setSlotHovering(idx, true); }}
                onMouseLeave={() => setSlotHovering(idx, false)}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  /* Placeholder — owner only */
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#fafafa",
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: "20px", color: "#d8d8d8", lineHeight: 1 }}>+</span>
                  </div>
                )}

                {/* Loading overlay */}
                {isLoading && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(255,255,255,0.75)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", color: "#aaaaaa" }}>…</span>
                  </div>
                )}

                {/* Delete button — shown on hover for existing photos */}
                {isOwner && url && isHover && !isLoading && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(idx); }}
                    style={{
                      position: "absolute", top: "8px", right: "8px",
                      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.04em",
                      color: "#ffffff", background: "rgba(0,0,0,0.50)",
                      border: "none", cursor: "pointer",
                      padding: "4px 7px", lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileRefs[idx]}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleUpload(idx, file);
                }}
                style={{ display: "none" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
