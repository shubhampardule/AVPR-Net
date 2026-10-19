const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  if (req.user.status !== "active") {
    return res.status(403).json({
      success: false,
      error: {
        code: "USER_INACTIVE",
        message: "User account is not active",
      },
    });
  }

  next();
};

module.exports = {
  requireAuth,
};