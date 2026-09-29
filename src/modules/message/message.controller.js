import { Router } from "express";
import { successResponse } from "./../../common/utils/response/success.response.js";
import { deleteMessageById, getAllMessages, getMessageById, sendMessage } from "./message.service.js";
import { localFileUpload } from "./../../common/utils/multer/local.multer.js";
import { fileFieldValidation } from "../../common/utils/multer/validation.multer.js";
import { validation } from "./../../middleware/validation.middleware.js";
import * as validators from "./message.validation.js";
import { badRequestException } from "../../common/utils/response/error.response.js";
import { authentication, optionalAuthentication } from "./../../middleware/authentication.middleware.js";

const router = Router();
router.get(
  "/list",
  authentication(),
  validation(validators.listMessages),
  async (req, res, next) => {
    const page = await getAllMessages(req.user, req.query);
    return successResponse({ res, status: 200, data: page });
  },
);


router.post(
  "/:receiverId",
  optionalAuthentication(),
  localFileUpload({
    customPath: "messages",
    validation: fileFieldValidation.image,
    maxSize: 1,
  }).array("attachments", 2),
  validation(validators.sendMessage),
  async (req, res, next) => {
    if (!req.body?.content && !req.files) {
      throw badRequestException({message:"validation error", extra:{
        message: "at least one key is required from [content , attachment]",
      }});
    }
    const message = await sendMessage(
      req.params.receiverId,
      req.files,
      req.body,
      req.user,
    );
    return successResponse({ res, status: 201, data: { message } });
  },
);
router.get(
  "/:messageId",
  authentication(),
  validation(validators.getMessage),
  async (req, res, next) => {
    const message = await getMessageById(req.params.messageId,req.user);
    return successResponse({ res, status: 200, data: { message } });
  },
);


router.delete(
  "/:messageId",
  authentication(),
  validation(validators.getMessage),
  async (req, res, next) => {
    const message = await deleteMessageById(req.params.messageId,req.user);
    return successResponse({ res, status: 200, data: { message } });
  },
);



export default router;
