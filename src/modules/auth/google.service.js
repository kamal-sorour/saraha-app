import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_IDS } from "../../../config/config.service.js";
import { serviceUnavailableException, unauthorizedException } from "../../common/utils/index.js";

const normalizeName = (value, fallback) => String(value ?? fallback).trim().slice(0, 25) || fallback;

export const createGoogleIdentityVerifier = ({
  client,
  clientIds = GOOGLE_CLIENT_IDS,
} = {}) => async (credential) => {
  if (!clientIds.length) {
    throw serviceUnavailableException({ message: "Google sign-in is not configured" });
  }

  let payload;
  try {
    const ticket = await (client ??= new OAuth2Client()).verifyIdToken({ idToken: credential, audience: clientIds });
    payload = ticket.getPayload();
  } catch {
    throw unauthorizedException({ message: "Invalid Google credential" });
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw unauthorizedException({ message: "Google account email is not verified" });
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    firstName: normalizeName(payload.given_name, "Google"),
    lastName: normalizeName(payload.family_name, "User"),
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
};

const verifyGoogleIdToken = createGoogleIdentityVerifier();
export { verifyGoogleIdToken };
