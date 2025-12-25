
// Main entrypoint for Monorepo deployment.
// Function Framework will look for exports here if this is the main package.

// Lazy load handlers to prevent one build failure from crashing the entire entrypoint
exports.hevyWebhookHandler = (req, res) => {
  const hevy = require('./hevy-handler/build/index');
  return hevy.hevyWebhookHandler(req, res);
};

exports.keiserPoller = (req, res) => {
  const keiser = require('./keiser-poller/build/index');
  return keiser.keiserPoller(req, res);
};

exports.stravaOAuthHandler = (req, res) => {
  const strava = require('./strava-oauth-handler/build/index');
  return strava.stravaOAuthHandler(req, res);
};

exports.fitbitOAuthHandler = (req, res) => {
  const fitbit = require('./fitbit-oauth-handler/build/index');
  return fitbit.fitbitOAuthHandler(req, res);
};
