"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MONO = "var(--font-mono)";
const RULE = "#e0e0da";

interface Props {
  initialPhoto: string | null;
  userId: string;
  isOwner: boolean;
}

export default function CollectionPhotos({ initialPhoto, userId, isOwner }: Props) {
  const router = useRouter();
  const [photo,      setPhoto]      = useState<string | null>(initialPhoto);
  const [loading,    setLoading]    = useState(false);
  const [hovering,   setHovering]   = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLightboxUrl(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleUpload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;
    setLoading(true);
    const supabase = createClient();
    const storagePath = `${userId}/1.jpg`;
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
          { user_id: userId, storage_path: storagePath, display_order: 1 },
          { onConflict: "user_id,display_order" }
        );
      if (dbErr) throw dbErr;

      setPhoto(`${publicUrl}?v=${Date.now()}`);
      router.refresh();
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    const storagePath = `${userId}/1.jpg`;
    try {
      await supabase.storage.from("collection-photos").remove([storagePath]);
      await supabase
        .from("collection_photos")
        .delete()
        .eq("user_id", userId)
        .eq("display_order", 1);
      setPhoto(null);
      setHovering(false);
      router.refresh();
    } catch (err) {
      console.error("Photo delete failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOwner && !photo) return null;

  return (
    <>
      <div>
        <p style={{
          fontFamily: MONO, fontSize: "8px", letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#aaaaaa", margin: "0 0 10px 0",
        }}>
          My Collection
        </p>
        <div style={{ height: 1, background: RULE, marginBottom: "20px" }} />

        {/* Photo frame — full column width, 16:9 */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            aspectRatio: "16 / 9",
            border: photo ? "1px solid #e0e0da" : "1px dashed #e0e0da",
            padding: photo ? "4px" : 0,
            background: "#ffffff",
            boxShadow: photo ? "3px 3px 0 0 #d0d0c8" : "none",
            cursor: photo ? "pointer" : (isOwner ? "pointer" : "default"),
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
          onClick={() => {
            if (loading) return;
            if (isOwner) fileRef.current?.click();
            else if (photo) setLightboxUrl(photo);
          }}
          onMouseEnter={() => { if (isOwner) setHovering(true); }}
          onMouseLeave={() => setHovering(false)}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#fafafa",
            }}>
              <span style={{ fontFamily: MONO, fontSize: "18px", color: "#d8d8d8", lineHeight: 1 }}>+</span>
            </div>
          )}

          {loading && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(255,255,255,0.75)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", color: "#aaaaaa" }}>…</span>
            </div>
          )}

          {isOwner && photo && hovering && !loading && (
            <button
              onClick={e => { e.stopPropagation(); handleDelete(); }}
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

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleUpload(file);
          }}
          style={{ display: "none" }}
        />
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain", display: "block",
              cursor: "default",
            }}
          />
        </div>
      )}
    </>
  );
}
