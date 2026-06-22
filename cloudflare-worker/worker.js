/**
 * Foyer — Unsplash OAuth Token Exchange Worker
 */

export default {
    async fetch(request, env) {

        // ── CORS ─────────────────────────────────────────────────────────────
        const origin  = request.headers.get('Origin') || '';
        const allowed = [
            'https://foyer-f0e5b.web.app',
            'https://foyer-f0e5b.firebaseapp.com',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://localhost:5500',
            'http://127.0.0.1:5500'
        ];
        const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

        const cors = {
            'Access-Control-Allow-Origin':  corsOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        };

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
        if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

        // ── Check Environment Variables ──────────────────────────────────────
        if (!env.UNSPLASH_CLIENT_ID || !env.UNSPLASH_CLIENT_SECRET) {
            return new Response(
                JSON.stringify({ error: 'Cloudflare Worker is missing Unsplash API keys. Please run `wrangler secret put`.' }),
                { status: 500, headers: cors }
            );
        }

        // ── Parse body ───────────────────────────────────────────────────────
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: cors });
        }

        const { code, redirect_uri } = body;
        if (!code || !redirect_uri) {
            return new Response(JSON.stringify({ error: 'Missing required fields: code, redirect_uri' }), { status: 400, headers: cors });
        }

// ── Exchange code → Unsplash access token ─────────────────────────────
        let tokenRes;
        try {
            tokenRes = await fetch('https://unsplash.com/oauth/token', {
                method:  'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',         // <-- Added: Tell firewall we want JSON
                    'User-Agent': 'Foyer-App/1.0'         // <-- Added: Bypass bot protection
                },
                body: JSON.stringify({
                    client_id:     env.UNSPLASH_CLIENT_ID,
                    client_secret: env.UNSPLASH_CLIENT_SECRET,
                    redirect_uri,
                    code,
                    grant_type: 'authorization_code'
                })
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Fetch request to Unsplash failed completely.' }), { status: 502, headers: cors });
        }

        // Safely read response as text first, so HTML errors don't crash the JSON parser
        const responseText = await tokenRes.text();
        let tokenData;
        
        try {
            tokenData = JSON.parse(responseText);
        } catch (e) {
            console.error('Unsplash returned non-JSON:', responseText);
            return new Response(JSON.stringify({ error: `Unsplash API Error (${tokenRes.status}): Expected JSON but got HTML/Text. Check your Secret Key.` }), { status: 502, headers: cors });
        }

        if (!tokenRes.ok) {
            return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error || 'Unsplash token exchange failed' }), { status: 400, headers: cors });
        }

        // ── Return only what the frontend needs ──────────────────────────────
        return new Response(
            JSON.stringify({
                access_token: tokenData.access_token,
                username:     tokenData.username
            }),
            { status: 200, headers: cors }
        );
    }
};