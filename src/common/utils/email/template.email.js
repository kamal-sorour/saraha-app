const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

export const emailTemplate = ({ code, title }) => {
  return `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <h2>${escapeHtml(title)}</h2>
      <p>Your confirmation code is:</p>
      <h1 style="color: #4CAF50; letter-spacing: 5px;">${escapeHtml(code)}</h1>
    </div>
  `;
};