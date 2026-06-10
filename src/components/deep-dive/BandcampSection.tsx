"use client";

import { useState } from "react";
import Link from "next/link";

const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const TINT   = "#FDF6F0";
const INK    = "#0d0d0d";

interface Props {
  userId:            string;
  bandcampUsername:  string | null;
  lastSyncTotal:     number;
  lastSyncDuplicates: number;
  lastSyncDate:      string | null;
}

type SyncState = "idle" | "syncing" | "done" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function BandcampSection({
  userId,
  bandcampUsername,
  lastSyncTotal,
  lastSyncDuplicates,
  lastSyncDate,
}: Props) {
  const [syncState,  setSyncState]  = useState<SyncState>("idle");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    total: number; duplicates: number; new: number; message: string; date: string;
  } | null>(null);

  const hasPriorSync = lastSyncDate !== null;
  const isSyncing    = syncState === "syncing";
  const hasSynced    = syncState === "done" || (syncState === "idle" && hasPriorSync);

  async function handleSync() {
    setSyncState("syncing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/deep-dive/bandcamp-import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId }),
      });
      const json = await res.json() as {
        success?: boolean;
        error?: string;
        total?: number;
        duplicates?: number;
        new?: number;
        message?: string;
      };
      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Import failed. Please try again.");
        setSyncState("error");
      } else {
        setSyncResult({
          total:      json.total      ?? 0,
          duplicates: json.duplicates ?? 0,
          new:        json.new        ?? 0,
          message:    json.message    ?? "",
          date:       new Date().toISOString(),
        });
        setSyncState("done");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setSyncState("error");
    }
  }

  const containerStyle: React.CSSProperties = {
    background:   TINT,
    padding:      "16px 20px",
    marginBottom: "0",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      "9px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color:         ORANGE,
    display:       "block",
    marginBottom:  "8px",
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      "0.7rem",
    color:         INK,
    letterSpacing: "0.02em",
  };

  const subStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      "0.65rem",
    color:         INK,
    letterSpacing: "0.02em",
  };

  const btnStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      "9px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color:         "#ffffff",
    background:    isSyncing ? "rgba(204,85,0,0.6)" : ORANGE,
    border:        "none",
    cursor:        isSyncing ? "default" : "pointer",
    padding:       "8px 16px",
    whiteSpace:    "nowrap" as const,
  };

  const resyncStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      "0.65rem",
    color:         ORANGE,
    background:    "none",
    border:        "none",
    cursor:        "pointer",
    padding:       0,
  };

  // State: no username set
  if (!bandcampUsername) {
    return (
      <div style={containerStyle}>
        <span style={labelStyle}>Bandcamp Collection</span>
        <p style={{ ...subStyle, margin: 0 }}>
          Add your Bandcamp username in{" "}
          <Link href="/settings/profile" style={{ color: ORANGE, textDecoration: "none" }}>
            profile settings →
          </Link>
          {" "}to import your digital collection into Deep Dive.
        </p>
      </div>
    );
  }

  // Derive display values — prefer live sync result over server-fetched props
  const displayTotal      = syncResult?.total      ?? lastSyncTotal;
  const displayDuplicates = syncResult?.duplicates ?? lastSyncDuplicates;
  const displayDate       = syncResult?.date        ?? lastSyncDate;

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Bandcamp Collection</span>

      {/* Username row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ ...bodyStyle, margin: "0 0 6px 0" }}>
            bandcamp.com/{bandcampUsername}
          </p>

          {/* Syncing status line */}
          {isSyncing && (
            <p style={{ ...subStyle, margin: "0 0 4px 0" }}>
              Fetching your Bandcamp collection...
            </p>
          )}

          {/* Synced result */}
          {hasSynced && displayDate && (
            <>
              <p style={{ ...bodyStyle, margin: "0 0 2px 0" }}>
                ✓ {displayTotal.toLocaleString()} albums · {displayDuplicates.toLocaleString()} already in your physical collection
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <p style={{ ...subStyle, margin: 0 }}>
                  Last synced: {formatDate(displayDate)}
                </p>
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  style={resyncStyle}
                >
                  Re-sync
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {(syncState === "error" || syncState === "idle") && errorMsg && (
            <p style={{ ...subStyle, color: "#cc3300", margin: "4px 0 0" }}>{errorMsg}</p>
          )}
        </div>

        {/* Sync button — shown when not yet synced, or after error */}
        {!hasSynced && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            style={btnStyle}
          >
            {isSyncing ? "Syncing..." : "Sync Bandcamp"}
          </button>
        )}
      </div>
    </div>
  );
}
