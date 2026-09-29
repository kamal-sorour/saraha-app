import { Router } from "express";
import { successResponse } from "../../common/utils/index.js";
import * as validators from "./auth.validation.js";
import { validation } from "./../../middleware/index.js";
import * as defaultAuthService from "./auth.service.js";
import { limiterLogin as defaultLimiterLogin } from "../../middleware/limiter.js";
import { deleteKey as defaultDeleteKey } from "../../common/services/redis.service.js";
import { toPublicUser } from "../user/user.dto.js";

export const createAuthRouter = ({
  authService = defaultAuthService,
  limiterLogin = defaultLimiterLogin,
  deleteLoginKey = defaultDeleteKey,
} = {}) => {
  const router = Router();

  router.patch("/confirm-email", validation(validators.confirmEmail), async (req, res) => {
    await authService.confirmEmail(req.body);
    return successResponse({ res });
  });

  router.patch("/resend-confirm-email", validation(validators.reSendConfirmEmail), async (req, res) => {
    await authService.resendConfirmEmail(req.body);
    return successResponse({ res });
  });

  router.post("/request-forgot-password-code", validation(validators.verifyEmail), async (req, res) => {
    await authService.requestForgotPasswordCode(req.body);
    return successResponse({ res, status: 201 });
  });

  router.patch("/verify-forgot-password-code", validation(validators.verifyForgotPasswordCode), async (req, res) => {
    await authService.verifyForgotPasswordCode(req.body);
    return successResponse({ res, status: 201 });
  });

  router.patch("/reset-forgot-password-code", validation(validators.resetForgotPasswordCode), async (req, res) => {
    await authService.resetForgotPasswordCode(req.body);
    return successResponse({ res, status: 201 });
  });

  router.post("/signup", validation(validators.signup), async (req, res) => {
    const account = await authService.Signup(req.body);
    return successResponse({ res, status: 201, data: { account: toPublicUser(account) } });
  });

  router.post("/login", limiterLogin, validation(validators.login), async (req, res) => {
    const account = await authService.login(req.body);
    await deleteLoginKey(`${req.ip}-${req.path}`);
    return successResponse({ res, status: 200, data: account });
  });

  return router;
};

export default createAuthRouter();
