const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const env = require("./env");
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: env.google.clientId,
      clientSecret: env.google.clientSecret,
      callbackURL: env.google.callbackUrl,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google account email not available"));
        }

        let user = await User.findOne({
          googleId: profile.id,
        });

        if (!user) {
          user = await User.findOne({
            email: email.toLowerCase(),
          });
        }

        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email: email.toLowerCase(),
            profileImage: profile.photos?.[0]?.value || null,
            googleId: profile.id,
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          user.profileImage =
            profile.photos?.[0]?.value || user.profileImage;

          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;