


// utils.js — helpers compartidos

function escapeHtml(str){
  if(str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url){
  if(!url) return "";
  const u = String(url).trim();
  if(/^(https?:|data:image\/)/i.test(u)) return escapeHtml(u);
  return "";
}