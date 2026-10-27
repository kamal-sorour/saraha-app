import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import {
  System_TOKEN_SECRET_KEY,
  USER_TOKEN_SECRET_KEY,
  System_REFRESH_TOKEN_SECRET_KEY,
  USER_REFRESH_TOKEN_SECRET_KEY,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
} from "../../../../config/config.service.js";
import { randomUUID } from 'node:crypto';
import { RoleEnum, AudienceEnum, tokenTypeEnum } from "../../enums/index.js";
import { get, revokeTokenKey } from './../../services/redis.service.js';
import { UserModel } from "../../../DB/index.js";
import { unauthorizedException } from "../index.js";

const TOKEN_ISSUER = "Saraha_App";

export const generateToken = async ({
  payload = {},
  secret = USER_TOKEN_SECRET_KEY,
  options = {},
} = {}) => {
  return jwt.sign(payload, secret, options);
};

export const getTokenSignature = async (role) => {
  let accessSignature = undefined;
  let refreshSignature = undefined;
  let audience = AudienceEnum.User;
  switch (role) {
    case RoleEnum.Admin:
      accessSignature = System_TOKEN_SECRET_KEY;
      refreshSignature = System_REFRESH_TOKEN_SECRET_KEY;
      audience = AudienceEnum.System;
      break;

    default:
      accessSignature = USER_TOKEN_SECRET_KEY;
      refreshSignature = USER_REFRESH_TOKEN_SECRET_KEY;
      audience = AudienceEnum.User;
      break;
  }
  return { accessSignature, refreshSignature, audience };
};

export const createLoginCredentiels = async (userInfo) => {
  const { accessSignature, refreshSignature, audience } = await getTokenSignature(userInfo.role);
  const jwtid = randomUUID();

  const access_token = await generateToken({
    payload: { sub: userInfo._id, sv: userInfo.sessionVersion ?? 0 },
    secret: accessSignature,
    options: {
      issuer: TOKEN_ISSUER,
      audience: [tokenTypeEnum.access, audience],
      expiresIn: ACCESS_EXPIRES_IN,
      jwtid
    }
  });

  const refresh_token = await generateToken({
    payload: { sub: userInfo._id, sv: userInfo.sessionVersion ?? 0 },
    secret: refreshSignature,
    options: {
      issuer: TOKEN_ISSUER,
      audience: [tokenTypeEnum.refresh, audience],
      expiresIn: REFRESH_EXPIRES_IN,
      jwtid
    }
  });

  return { access_token, refresh_token };
};

export const isSessionCurrent = (decoded, user) => (
  (decoded.sv ?? 0) === (user.sessionVersion ?? 0)
);

export const hasExpectedAudience = (tokenAudience, { tokenType, audience }) => {
  const values = Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience];
  return values.includes(tokenType) && values.includes(audience);
};

export const decodeToken = async ({ token, tokenType = tokenTypeEnum.access }) => {
  const unverified = jwt.decode(token);
  if (!unverified || typeof unverified !== "object" || !Types.ObjectId.isValid(unverified.sub)) {
    throw unauthorizedException({ message: "Invalid token payload or token revoked" });
  }

  const user = await UserModel.findById(unverified.sub);
  if (!user) {
    throw unauthorizedException({ message: "Invalid token payload or token revoked" });
  }

  const signatures = await getTokenSignature(user.role);
  const secret = tokenType === tokenTypeEnum.access
    ? signatures.accessSignature
    : signatures.refreshSignature;
  let decoded;
  try {
    decoded = jwt.verify(token, secret, { issuer: TOKEN_ISSUER, algorithms: ["HS256"] });
  } catch {
    throw unauthorizedException({ message: "Invalid token payload or token revoked" });
  }

  if (!decoded.jti || !hasExpectedAudience(decoded.aud, { tokenType, audience: signatures.audience }) || await get(revokeTokenKey({ userId: decoded.sub, jti: decoded.jti }))) {
    throw unauthorizedException({ message: "Invalid token payload or token revoked" });
  }

  if (!isSessionCurrent(decoded, user)) {
    throw unauthorizedException({ message: "Token expired due to credentials change" });
  }

  return { user, decoded };
};
