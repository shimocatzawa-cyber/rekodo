"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const MUTED  = "#aaaaaa";

interface Props {
  initialPhoto: string | null;
  isOwner: boolean;
  photoOwnerId?: string;
  viewerId?: string | null;
  initialLikeCount?: number;
  initialLiked?: boolean;
}

export default function CollectionPhotos({ initialPhoto, isOwner, photoOwnerId, viewerId, initialLikeCount = 0, initialLiked = false }: Props) {
  const router = useRouter();
  const [photo,       setPhoto]       = useState<string | null>(initialPhoto);
  const [loading,     setLoading]     = useState(false);
  const [hovering,    setHovering]    = useState(false);
  const [dragging,    setDragging]    = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [likeCount,   setLikeCount]   = useState(initialLikeCount);
  const [liked,       setLiked]       = useState(initialLiked);
  const [liking,      setLiking]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLike() {
    if (!photoOwnerId || !viewerId || isOwner || liking) return;
    setLiking(true);
    const optimisticLiked = !liked;
    setLiked(optimisticLiked);
    setLikeCount(c => c + (optimisticLiked ? 1 : -1));
    try {
      const res = await fetch("/api/collection/photo/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: photoOwnerId }),
      });
      const data = await res.json() as { liked: boolean; count: number };
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch {
      setLiked(!optimisticLiked);
      setLikeCount(c => c + (optimisticLiked ? -1 : 1));
    } finally {
      setLiking(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLightboxUrl(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function resizeToBlob(file: File, maxPx = 2000, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, maxPx / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas toBlob failed")), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
      img.src = url;
    });
  }

  async function handleUpload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Only JPEG, PNG and WebP images are supported.");
      return;
    }
    setLoading(true);
    setUploadError(null);
    try {
      const resized = await resizeToBlob(file);
      const form = new FormData();
      form.append("file", resized, "photo.jpg");
      const res = await fetch("/api/collection/photo", { method: "POST", body: form });
      const json = await res.json() as { publicUrl?: string; error?: string };
      if (!res.ok || json.error) {
        setUploadError(json.error ?? "Upload failed.");
        return;
      }
      setPhoto(json.publicUrl!);
      router.refresh();
    } catch (err) {
      console.error("Photo upload failed:", err);
      setUploadError("Upload failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch("/api/collection/photo", { method: "DELETE" });
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 4px 0" }}>
          <p style={{
            fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: ORANGE, margin: 0,
          }}>
            My Collection
          </p>
          {photo && (
            isOwner ? (
              likeCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "16px", color: ORANGE, lineHeight: 1 }}>♥</span>
                  <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: MUTED }}>{likeCount}</span>
                </span>
              )
            ) : (
              <button
                onClick={handleLike}
                disabled={!viewerId || liking}
                title={!viewerId ? "Log in to like" : liked ? "Unlike" : "Like"}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  background: "none", border: "none", padding: 0,
                  cursor: !viewerId ? "default" : "pointer",
                  transition: "transform 0.1s",
                  transform: liking ? "scale(0.85)" : "scale(1)",
                }}
                aria-label={liked ? "Unlike photo" : "Like photo"}
              >
                <span style={{ fontSize: "12px", color: liked ? ORANGE : "#cccccc", lineHeight: 1, transition: "color 0.15s" }}>♥</span>
                {likeCount > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em", color: MUTED }}>{likeCount}</span>
                )}
              </button>
            )
          )}
        </div>
        {isOwner && (
          <>
            <p style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.04em",
              color: "#aaaaaa", margin: "0 0 4px 0",
            }}>
              Add a photo of your collection.
            </p>
            <p style={{
              fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.06em",
              color: "#cccccc", margin: "0 0 14px 0",
            }}>
              JPEG, PNG or WebP · Max 5 MB
            </p>
          </>
        )}
        {uploadError && (
          <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.04em", color: "#cc3300", margin: "0 0 10px 0" }}>
            {uploadError}
          </p>
        )}

        {/* Photo frame */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            border: dragging ? `1px dashed ${ORANGE}` : (photo ? "1px solid #e0e0da" : "1px dashed #e0e0da"),
            padding: photo ? "4px" : 0,
            background: dragging ? "#fff8f5" : "#ffffff",
            boxShadow: photo && !dragging ? "3px 3px 0 0 #d0d0c8" : "none",
            cursor: isOwner ? "pointer" : (photo ? "zoom-in" : "default"),
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
            transition: "border-color 0.1s, background 0.1s",
          }}
          onClick={() => {
            if (loading) return;
            if (isOwner) fileRef.current?.click();
            else if (photo) setLightboxUrl(photo);
          }}
          onMouseEnter={() => { if (isOwner) setHovering(true); }}
          onMouseLeave={() => setHovering(false)}
          onDragOver={e => { if (!isOwner) return; e.preventDefault(); setDragging(true); }}
          onDragEnter={e => { if (!isOwner) return; e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            if (!isOwner || loading) return;
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
          }}
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
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "6px",
              background: dragging ? "#fff8f5" : "#fafafa",
            }}>
              <span style={{ fontFamily: MONO, fontSize: "18px", color: dragging ? ORANGE : "#d8d8d8", lineHeight: 1 }}>+</span>
              {isOwner && (
                <span style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.08em", color: dragging ? ORANGE : "#d8d8d8" }}>
                  {dragging ? "DROP TO UPLOAD" : "CLICK OR DRAG"}
                </span>
              )}
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
