import { OAuth2Client } from "google-auth-library";
import { config } from "../config/env.js";

const client = new OAuth2Client(config.googleClientId);

export async function verifyGoogleToken({ idToken, accessToken }) {
  if (!idToken && !accessToken) {
    const error = new Error("Google ID token or Access token is required");
    error.statusCode = 400;
    throw error;
  }

  try {
    if (idToken) {
      const ticket = await client.verifyIdToken({
        idToken,
        ...(config.googleClientId && { audience: config.googleClientId }),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        const error = new Error("Invalid Google token payload");
        error.statusCode = 400;
        throw error;
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture,
      };
    }

    if (accessToken) {
      // Official Google OAuth2 userinfo v2 endpoint
      let res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        // Fallback to OpenID Connect v1 userinfo endpoint
        res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Google Userinfo API returned status ${res.status}: ${errBody}`);
      }

      const payload = await res.json();
      const email = payload.email;
      const sub = payload.id || payload.sub;

      if (!payload || !email) {
        const error = new Error("Invalid Google userinfo payload");
        error.statusCode = 400;
        throw error;
      }

      return {
        googleId: sub,
        email: email,
        name: payload.name || email.split("@")[0],
        picture: payload.picture || payload.photo || payload.avatar_url || null,
      };
    }
  } catch (err) {
    const error = new Error(`Google authentication failed: ${err.message}`);
    error.statusCode = 401;
    throw error;
  }
}
