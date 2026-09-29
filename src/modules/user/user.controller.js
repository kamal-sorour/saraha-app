import { Router } from "express";
import { logout, profile, updatePassword, updateProfile, updateProfilePicture } from "./user.service.js";
import { successResponse } from "../../common/utils/index.js";
import { fileFieldValidation, localFileUpload } from "../../common/utils/multer/index.js";
import { validation } from './../../middleware/validation.middleware.js';
import * as validators from "./../auth/auth.validation.js";
import { authentication } from "../../middleware/authentication.middleware.js";
import * as userValidators from "./user.validation.js";
import { forbiddenException } from "../../common/utils/response/error.response.js";

const router = Router()


router.patch(
  "/password",
  authentication(),
  validation(validators.updatePassword),
  async(req,res,next)=>{
    const credentails = await updatePassword(req.body, "Saraha_App",req.user)
    return successResponse({res, data:{...credentails}})
  }
)


router.post("/logout",authentication() ,async (req, res, next)=>{
  try {
    
    const account = await logout(req.body, req.user, req.decoded)
    return successResponse({res, account})
  } catch (error) {
    
    next(error)
  }
} )

router.patch("/profile-image",authentication(),localFileUpload({
  customPath:"users/profile",
  // validation:[...fileFieldValidation.image,fileFieldValidation.video[0]]
  validation:fileFieldValidation.image,
  maxSize:7
}).single("attachment"),async(req,res,next)=>{
  if (!req.file) throw forbiddenException({ message: "An image file is required" });
  const account = await updateProfilePicture(req.user._id, req.file);
  return successResponse({res,data:{account}})
})

router.get("/:userId",validation(userValidators.userId),async (req,res,next)=>{
  const account = await profile(req.params.userId)
  return successResponse({res, data:{account}})

})

router.patch("/:userId", authentication(), validation(userValidators.updateProfile), async (req, res, next) => {
  if (String(req.user._id).toLowerCase() !== req.params.userId.toLowerCase()) {
    throw forbiddenException({ message: "You can only update your own profile" });
  }
  const account = await updateProfile(req.user._id, req.body);
  return successResponse({ res, status: 200, data: { account } });
})



export default router