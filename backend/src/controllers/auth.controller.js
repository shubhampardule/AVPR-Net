const ApiResponse = require("../utils/ApiResponse");

const googleCallback = (req, res) => {
  return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5174"}/dashboard`);
};

const getCurrentUser = (req, res) => {
  return ApiResponse.success(
    res,
    {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        profileImage: req.user.profileImage,
        githubUsername: req.user.githubUsername || null,
      },
    },
    "Authenticated user"
  );
};

const logout = (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error);
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie("securepatch.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      return ApiResponse.success(
        res,
        null,
        "Logout successful"
      );
    });
  });
};

module.exports = {
  googleCallback,
  getCurrentUser,
  logout
};
