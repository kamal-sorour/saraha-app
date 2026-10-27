import { createAuthRouter } from "./auth.controller.js";
import * as authService from "./auth.service.js";
import { limiterGoogle, limiterLogin } from "../../middleware/limiter.js";
import { deleteKey } from "../../common/services/redis.service.js";

export const authRouter = createAuthRouter({
  authService,
  limiterLogin,
  limiterGoogle,
  deleteLoginKey: deleteKey,
});
