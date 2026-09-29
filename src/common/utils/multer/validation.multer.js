// export const fileFieldValidation = {
//   image:["image/jpeg","image/jpg","image/png"],
//   video:["video/mp4"]
// }
// export const fileFilter = (validation =[])=>{
// return function (req, res,cb){
//   if (!validation.includes(file.mimetype)) {
//     return cb(new Error ("invalid file formate",{cause:{status:400}}, false))

//   }
//   return cb(null,true)
// }
// }

export const fileFieldValidation = {
  image: ["image/jpeg", "image/jpg", "image/png"],
  video: ["video/mp4"]
}

export const fileFilter = (validation = []) => {
  return function (req, file, cb) { 
    if (!validation.includes(file.mimetype)) {
      return cb(new Error("invalid file format", { cause: { status: 400 } }), false);
    }
    return cb(null, true);
  }
}