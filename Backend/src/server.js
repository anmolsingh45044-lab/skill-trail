import { config } from './config.js';
import { createApp } from './app.js';
import { initializeDatabase } from './db.js';

await initializeDatabase();

const app = createApp();

// Health Check API for Render
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Skill Trail Server is Running!',
        timestamp: new Date().toISOString()
    });
});

app.listen(config.port, () => {
    console.log(`Skill Trail API running on port ${config.port}`);

    if (!config.googleClientId) {
        console.log('Google sign-in is off: set GOOGLE_CLIENT_ID in Backend/.env to turn it on.');
    }
});