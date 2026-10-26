'use strict';
const APP_ORIGIN = 'https://flownova-ai.vercel.app';
const REPOSITORY = 'https://github.com/manikantbindass/FlowNovaAI';
function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && !url.username && !url.password;
  } catch { return false; }
}
function isRepositoryUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://github.com' && !url.username && !url.password &&
      (url.pathname === '/manikantbindass/FlowNovaAI' || url.pathname.startsWith('/manikantbindass/FlowNovaAI/'));
  } catch { return false; }
}
module.exports = { APP_ORIGIN, REPOSITORY, isAppUrl, isRepositoryUrl };
