import { NextRequest, NextResponse } from "next/server";

const UNSPLASH_CLIENT_ID = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY!;
const UNSPLASH_CLIENT_SECRET = process.env.UNSPLASH_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const resp = await fetch("https://unsplash.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: UNSPLASH_CLIENT_ID,
        client_secret: UNSPLASH_CLIENT_SECRET,
        redirect_uri: `${req.nextUrl.origin}/unsplash-callback`,
        code,
        grant_type: "authorization_code",
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Unsplash token exchange failed:", data);
      return NextResponse.json({ error: "Token exchange failed" }, { status: 400 });
    }

    const token = data.access_token as string;

    // Fetch the user's Unsplash profile
    const profileResp = await fetch("https://api.unsplash.com/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileResp.json();
    const username = profile.username as string;

    // Check if a Foyer collection exists, create if not
    let collectionId: string | null = null;
    const collectionsResp = await fetch(
      `https://api.unsplash.com/users/${username}/collections?per_page=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const collections: any[] = await collectionsResp.json();
    const foyerCollection = collections.find(
      (c: any) => c.title === "Foyer"
    );
    if (foyerCollection) {
      collectionId = foyerCollection.id;
    } else {
      const createResp = await fetch("https://api.unsplash.com/collections", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Foyer",
          description: "Photos I like from my Foyer homepage wallpapers",
          private: false,
        }),
      });
      const created = await createResp.json();
      if (createResp.ok) {
        collectionId = created.id;
      }
    }

    return NextResponse.json({
      accessToken: token,
      username,
      foyerCollectionId: collectionId,
    });
  } catch (err) {
    console.error("Unsplash OAuth error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
