const { getUser } = require('../db');
const AppError = require('../utils/appError');

/**
 * Loads the single local profile into req.user for controller compatibility.
 */
function loadUser(req, res, next) {
  const user = getUser();
  if (!user) {
    return next(new AppError('Local profile not found.', 500));
  }
  req.user = user;
  next();
}

module.exports = { loadUser };
