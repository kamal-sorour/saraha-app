const write = (level, message, context = {}) => {
  const record = { timestamp: new Date().toISOString(), level, message, ...context };
  const output = JSON.stringify(record);
  if (level === "error") console.error(output);
  else console.log(output);
};

export const logger = {
  info: (message, context) => write("info", message, context),
  error: (message, context) => write("error", message, context),
};