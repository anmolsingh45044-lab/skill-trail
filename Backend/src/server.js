import { config } from './config.js';
import { createApp } from './app.js';

createApp().listen(config.port, () => {
  console.log(`Skill Trail API running on http://localhost:${config.port}`);
  if (!config.googleClientId) console.log('Google sign-in is off: set GOOGLE_CLIENT_ID in Backend/.env to turn it on.');
});
