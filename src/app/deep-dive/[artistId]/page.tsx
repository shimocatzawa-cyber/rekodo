import { redirect } from "next/navigation";

type Params = Promise<{ artistId: string }>;

// Individual artist deep dives now live on the main /deep-dive page.
export default async function ArtistDeepDivePage(_: { params: Params }) {
  redirect("/deep-dive");
}
