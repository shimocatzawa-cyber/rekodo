import { NextResponse } from "next/server";

const content = `# rekōdo

> rekōdo is a music identity platform built for serious vinyl collectors.

rekōdo lets vinyl collectors catalogue their records, discover their collector archetype, explore in-depth artist discographies, build curated lists, and connect with a community of like-minded collectors. It is independent, ad-free, and built by people who own too many records.

## Core features

- **Collection**: Import and catalogue your vinyl collection from Discogs, Bandcamp, or CSV. Track artist, album, year, label, genre, pressing colour, and more.
- **Archetypes**: AI analysis of your collection to place you into one of rekōdo's collector archetypes — a reflection of what your records say about you as a listener.
- **Deep Dive**: Explore an artist's full discography viewed through the lens of your collection. See what you own, what you're missing, and related artists.
- **Taste Profile (Insights)**: A dashboard showing your music taste mapped across genres, decades, labels, pressing origins, and other dimensions.
- **Dig**: AI-powered record recommendations based on your collection profile and taste archetype.
- **Selects**: Build and share curated lists of your most considered records.
- **Community**: Match with collectors who share similar tastes. See collection overlap and similarity scores.
- **Wantlist**: Track records you want to own.

## Supported integrations

- Discogs (collection import)
- Bandcamp (collection import)
- Spotify (playback in-app)
- CSV upload

## Pricing

rekōdo is free to use. A supporter subscription ($5/month, billed in local currency) unlocks the full feature set including Deep Dive, Taste Profile, Archetypes, and Wantlist upload. One-off donations are also accepted.

## URLs

- Homepage: https://rekodo.co
- Support / About: https://rekodo.co/about
- Login: https://rekodo.co/login

Note: profiles, lists, and all collection content require a rekōdo account to view.
`;

export function GET() {
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
