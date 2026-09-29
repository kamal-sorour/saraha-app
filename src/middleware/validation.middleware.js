import { badRequestException } from './../common/utils/response/error.response.js';

export const validation = (schema) => {
  return (req, res, next) => {
    const validationErrors = [];

    for (const key of Object.keys(schema)) {
      const dataToValidate = req[key]; 
      
      if (schema[key]) {
        const validationResult = schema[key].validate(dataToValidate, { abortEarly: false, allowUnknown: false });

        if (validationResult.error) {
          const errorMessages = validationResult.error.details.map(err => err.message).join(", ");
          validationErrors.push(errorMessages);
        } else {
          req[key] = validationResult.value;
        }
      }
    }

    if (validationErrors.length > 0) {
return next(badRequestException({ message: validationErrors.join(", ") }));
    }
    
    return next();
  };
};
