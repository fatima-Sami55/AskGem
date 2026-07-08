const AppError = require('../utils/appError');

/** Header value the Settings UI must send to authorize destructive wipe. */
const CLEAR_ALL_CONFIRM_HEADER = 'X-AskPeri-Confirm';
const CLEAR_ALL_CONFIRM_VALUE = 'clear-all';

/**
 * Lightweight guard for POST /settings/clear-all.
 *
 * Threat model: AskPeri binds to localhost for a single local user. Remote
 * attackers are out of scope, but malicious browser extensions, crafted pages
 * on the same machine, or scripts that discover the open port could otherwise
 * trigger a wipe without user intent. Requiring a non-obvious confirm header
 * blocks drive-by fetch/XHR from arbitrary origins while keeping the Settings
 * modal the sole intentional caller — no full login system required.
 */
function requireClearAllConfirm(req, res, next) {
  const provided = req.get(CLEAR_ALL_CONFIRM_HEADER);
  if (provided !== CLEAR_ALL_CONFIRM_VALUE) {
    return next(new AppError('Clear-all requires confirmation from Settings.', 403));
  }
  next();
}

module.exports = {
  requireClearAllConfirm,
  CLEAR_ALL_CONFIRM_HEADER,
  CLEAR_ALL_CONFIRM_VALUE,
};
