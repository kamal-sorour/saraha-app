import bootstrap from "./bootstrap.app.js";
import { logger } from "./common/utils/logger.js";
import mongoose from "mongoose";
import { closeRedis } from "./DB/redis.connection.db.js";
import { closeEmailQueue } from "./common/utils/email/email.queue.js";

bootstrap()
	.catch((error) => {
		logger.error("application_startup_failed", { errorName: error.name, errorMessage: error.message, stack: error.stack });
		Promise.allSettled([closeEmailQueue(), closeRedis(), mongoose.disconnect()]).finally(() => {
			process.exitCode = 1;
		});
	});
