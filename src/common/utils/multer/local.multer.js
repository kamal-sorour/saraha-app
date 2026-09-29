// import multer from "multer";
// import { randomUUID } from "node:crypto";
// import { resolve } from 'node:path';
// import { fileFilter } from "./validation.multer.js";

// export const localFileUpload = (
//   {
//     customPath = "general",
//     validation =[]
//   }={}) =>{
//   const storage = multer.diskStorage({
//     destination:function (req,file,cb){
//       cb(null , resolve("../upload"))
//     },
//     filename:function (req,file,cb){
//       const uniqueFileName = randomUUID()+" "+file.originalname
//       cb(null, uniqueFileName)
//     }
//   })
//   // return multer({dest:"./temp"})
//   return multer({fileFilter:fileFilter(validation),storage})
// }

import multer from "multer";
import { randomUUID } from "node:crypto";
import { resolve, join, basename } from 'node:path';
import fs from 'node:fs';
import { fileTypeFromFile } from 'file-type';
import { fileFilter } from "./validation.multer.js";

export const localFileUpload = ({
    customPath = "general",
    validation = [],
    maxSize = 7,
} = {}) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const folderPath = resolve(`uploads/${customPath}`);
            
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            file.finalPath = join("uploads", customPath); 
            
            cb(null, folderPath);
        },
        filename: function (req, file, cb) {
            const safeExtension = file.originalname.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] ?? "";
            const uniqueFileName = randomUUID() + safeExtension;
            
            file.finalPath = join(file.finalPath, uniqueFileName);
            
            cb(null, uniqueFileName);
        }
    });

    const upload = multer({
        fileFilter: fileFilter(validation),
        storage,
        limits: { fileSize: maxSize * 1024 * 1024, files: 2, fields: 20, parts: 24 },
    });

    return {
        single(fieldName) {
            const handler = upload.single(fieldName);
            return async (req, res, next) => handler(req, res, async (error) => {
                if (error) return next(error);
                if (!req.file) return next();
                try {
                    const detected = await fileTypeFromFile(req.file.path);
                    if (!detected || !validation.includes(detected.mime)) {
                        fs.rmSync(req.file.path, { force: true });
                        return next(new Error("Uploaded file content does not match an allowed image type", { cause: { status: 400 } }));
                    }
                    req.file.mimetype = detected.mime;
                    req.file.filename = basename(req.file.path);
                    next();
                } catch (validationError) {
                    fs.rmSync(req.file.path, { force: true });
                    next(validationError);
                }
            });
        },
        array(fieldName, maxCount) {
            const handler = upload.array(fieldName, maxCount);
            return async (req, res, next) => handler(req, res, async (error) => {
                if (error) return next(error);
                try {
                    for (const file of req.files ?? []) {
                        const detected = await fileTypeFromFile(file.path);
                        if (!detected || !validation.includes(detected.mime)) {
                            for (const uploaded of req.files ?? []) fs.rmSync(uploaded.path, { force: true });
                            return next(new Error("Uploaded file content does not match an allowed image type", { cause: { status: 400 } }));
                        }
                        file.mimetype = detected.mime;
                    }
                    next();
                } catch (validationError) {
                    for (const file of req.files ?? []) fs.rmSync(file.path, { force: true });
                    next(validationError);
                }
            });
        },
    };
}