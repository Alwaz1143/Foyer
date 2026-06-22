// ============================================
// FOYER — Firebase Cloud Functions
// ============================================
// Requires Firebase Blaze (pay-as-you-go) plan.
// For a personal app the usage is negligible — well under free tier limits.
//
// SETUP BEFORE DEPLOYING:
//   firebase functions:config:set \
//     unsplash.client_id="YOUR_UNSPLASH_APPLICATION_ID" \
//     unsplash.client_secret="YOUR_UNSPLASH_SECRET_KEY" \
//     unsplash.redirect_uri="https://foyer-f0e5b.web.app/unsplash-callback.html"
//
// For local emulator testing, create functions/.runtimeconfig.json:
// {
//   "unsplash": {
//     "client_id": "...",
//     "client_secret": "...",
//     "redirect_uri": "http://localhost:5000/unsplash-callback.html"
//   }
// }

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret }       = require('firebase-functions/params');
const admin                  = require('firebase-admin');

admin.initializeApp();

// Secrets (set via firebase functions:secrets:set UNSPLASH_CLIENT_SECRET)
// Using v2 secrets for better security
const UNSPLASH_CLIENT_ID     = defineSecret('UNSPLASH_CLIENT_ID');
const UNSPLASH_CLIENT_SECRET = defineSecret('UNSPLASH_CLIENT_SECRET');
const UNSPLASH_REDIRECT_URI  = defineSecret('UNSPLASH_REDIRECT_URI');

// ── exchangeUnsplashToken ─────────────────────────────────────────────────────
// Called by unsplash-callback.html after Unsplash redirects back with ?code=...
// Exchanges the authorization code for a long-lived access token and stores
// it in Firestore so future ♥ clicks can add photos to the user's Foyer collection.

exports.exchangeUnsplashToken = onCall(
    { secrets: [UNSPLASH_CLIENT_ID, UNSPLASH_CLIENT_SECRET, UNSPLASH_REDIRECT_URI] },
    async (request) => {
        // Require auth
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be signed in to connect Unsplash.');
        }

        const { code } = request.data;
        if (!code || typeof code !== 'string') {
            throw new HttpsError('invalid-argument', 'Missing or invalid authorization code.');
        }

        // Exchange authorization code → Unsplash access token
        let tokenData;
        try {
            const tokenRes = await fetch('https://unsplash.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id:     UNSPLASH_CLIENT_ID.value(),
                    client_secret: UNSPLASH_CLIENT_SECRET.value(),
                    redirect_uri:  UNSPLASH_REDIRECT_URI.value(),
                    code,
                    grant_type:    'authorization_code'
                })
            });

            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                console.error('Unsplash token exchange failed:', errText);
                throw new HttpsError('internal', 'Unsplash rejected the token exchange. Try reconnecting.');
            }

            tokenData = await tokenRes.json();
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            console.error('Network error during token exchange:', err);
            throw new HttpsError('internal', 'Network error during token exchange.');
        }

        // Store the access token in Firestore for this user
        await admin.firestore()
            .collection('users')
            .doc(request.auth.uid)
            .set({
                unsplash: {
                    accessToken:         tokenData.access_token,
                    username:            tokenData.username,
                    connectedAt:         new Date().toISOString(),
                    foyerCollectionId:   null   // Set on first ♥ click
                }
            }, { merge: true });

        console.log(`Unsplash connected for user ${request.auth.uid} as @${tokenData.username}`);

        return {
            success:  true,
            username: tokenData.username
        };
    }
);
