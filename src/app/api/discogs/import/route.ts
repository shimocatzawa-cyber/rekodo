import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchCollectionReleases } from "@/lib/discogs/oauth";
import { logCollectionAddActivity } from "@/lib/activity";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("dg_at")?.value;
  const tokenSecret = cookieStore.get("dg_ts")?.value;
  const username = cookieStore.get("dg_un")?.value;

  if (!accessToken || !tokenSecret || !username) {
    return Response.json({ error: "No Discogs session" }, { status: 400 });
  }

  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;

  try {
    const releases = await fetchCollectionReleases(
      key,
      secret,
      accessToken,
      tokenSecret,
      username
    );

    console.log(`Discogs import: fetched ${releases.length} releases for "${username}"`);

    if (releases.length === 0) {
      cookieStore.delete("dg_at");
      cookieStore.delete("dg_ts");
      cookieStore.delete("dg_un");
      return Response.json({ imported: 0 });
    }

    // Ensure profile exists
    const emailPrefix = (user.email ?? "").split("@")[0] || "user";
    await supabase.from("profiles").upsert(
      { id: user.id, username: `${emailPrefix}_${user.id.slice(0, 6)}` },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const BATCH = 100;

    // 1. Find which discogs_ids already exist in records
    const allDiscogsIds = releases.map((r) => r.discogs_id);
    const existingMap = new Map<string, string>(); // discogs_id -> record uuid
    for (let i = 0; i < allDiscogsIds.length; i += BATCH) {
      const { data, error } = await supabase
        .from("records")
        .select("id, discogs_id")
        .in("discogs_id", allDiscogsIds.slice(i, i + BATCH));
      if (error) console.error("records select error:", error.message);
      for (const r of data ?? []) {
        if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
      }
    }

    // 2. Insert only records that don't exist yet (avoids needing UPDATE permission)
    const newReleases = releases.filter((r) => !existingMap.has(r.discogs_id));
    console.log(`Discogs import: ${existingMap.size} existing, ${newReleases.length} new`);

    for (let i = 0; i < newReleases.length; i += BATCH) {
      const { data, error } = await supabase
        .from("records")
        .insert(
          newReleases.slice(i, i + BATCH).map((r) => ({
            discogs_id: r.discogs_id,
            artist: r.artist,
            album: r.album,
            year: r.year,
            genre: r.genre,
            cover_url: r.cover_url,
            label: r.label,
            format: r.format,
            country: r.country,
          }))
        )
        .select("id, discogs_id");
      if (error) {
        // Unique violation from a race — re-select this batch to get the IDs
        console.error("records insert error (likely race):", error.message);
        const batchIds = newReleases.slice(i, i + BATCH).map((r) => r.discogs_id);
        const { data: retried } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("discogs_id", batchIds);
        for (const r of retried ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
      } else {
        for (const r of data ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
      }
    }

    // 3. Build the full list of record UUIDs from both existing and newly inserted
    const savedRecordIds = releases
      .map((r) => existingMap.get(r.discogs_id))
      .filter((id): id is string => id !== undefined);

    console.log(`Discogs import: matched ${savedRecordIds.length} total records in DB`);

    // 4. Link records to the user's collection (skip already-linked ones).
    // Batch the .in() query to stay under URL limits and avoid the 1000-row cap.
    const alreadyLinked = new Set<string>();
    for (let i = 0; i < savedRecordIds.length; i += BATCH) {
      const { data: batchLinks } = await supabase
        .from("user_records")
        .select("record_id")
        .eq("user_id", user.id)
        .in("record_id", savedRecordIds.slice(i, i + BATCH));
      for (const l of batchLinks ?? []) alreadyLinked.add(l.record_id);
    }
    const newLinks = savedRecordIds
      .filter((id) => !alreadyLinked.has(id))
      .map((id) => ({ user_id: user.id, record_id: id }));

    for (let i = 0; i < newLinks.length; i += BATCH) {
      const { error } = await supabase
        .from("user_records")
        .insert(newLinks.slice(i, i + BATCH));
      if (error) console.error("user_records insert error:", error.message);
    }

    await logCollectionAddActivity(supabase, user.id, newLinks.map((l) => l.record_id));

    // Clear import cookies
    cookieStore.delete("dg_at");
    cookieStore.delete("dg_ts");
    cookieStore.delete("dg_un");

    return Response.json({
      added: newLinks.length,
      alreadyInCollection: alreadyLinked.size,
      total: releases.length,
    });
  } catch (err) {
    console.error("Discogs import:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
