import { tokenTypeEnum } from "../common/enums/security.enum.js";
import { forbiddenException, unauthorizedException } from "../common/utils/index.js";
import { decodeToken } from "../common/utils/security/token.security.js";

export const authentication = (tokenType = tokenTypeEnum.access) => {
  return async (req, res, next) => {
    try {
      const [key, credential, ...extra] = req.headers?.authorization?.trim().split(/\s+/) || [];

      if (key !== "Bearer" || !credential || extra.length || credential === 'null' || credential === 'undefined') {
        throw unauthorizedException({ message: 'Missing authorization' });
      }

      const { user, decoded } = await decodeToken({ token: credential, tokenType });
      req.user = user;
      req.decoded = decoded;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const optionalAuthentication = (tokenType = tokenTypeEnum.access) => {
  const requireAuthentication = authentication(tokenType);
  return (req, res, next) => req.headers?.authorization
    ? requireAuthentication(req, res, next)
    : next();
};

export const authorization = (accessRoles = []) => {
  return (req, res, next) => {
    if (!accessRoles.includes(req.user.role)) {
      throw forbiddenException({ message: "You don't have permission" });
    }
    next();
  };
};