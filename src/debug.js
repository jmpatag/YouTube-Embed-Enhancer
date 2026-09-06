// Debug logging — enable with localStorage.ytee_debug = "1" to surface diagnostics. (delete with delete localStorage.ytee_debug)
const YTEE_DEBUG = (() => { try { return localStorage.getItem("ytee_debug") === "1"; } catch (e) { return false; } })();
export const yteeWarn = (...a) => { if (YTEE_DEBUG) console.warn(...a); };
export const yteeLog = (...a) => { if (YTEE_DEBUG) console.log(...a); };
