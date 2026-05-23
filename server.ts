import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

// Initialize Telegram Bot if Token is provided
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;
if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram Bot started with polling.');
  
  bot.onText(/\/start(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match ? match[1] : null;
    
    // In Telegram Web Apps, the startapp parameter is passed in the URL.
    // The Telegram Bot API allows configuring WebApp URLs directly, but if using standard Inline Buttons with web_app:
    // the start_param is actually sent via direct bot attachments or menu button.
    // Assuming the user just configures their bot link as https://t.me/BotName?startapp=X
    
    const appUrl = process.env.APP_URL || 'https://example.com'; 
    const finalUrl = startParam ? `${appUrl}?startapp=${startParam}` : appUrl;
    
    let welcomeMessage = `🎉 Welcome to xN Coin Bot! 🪙\n\nWatch ads, complete tasks, and earn coins effortlessly! Convert your coins to real money.\n\nClick the button below to start earning now! 🚀`;

    if (startParam) {
      welcomeMessage = `🎉 Welcome to xN Coin Bot! 🪙\n\nYou were referred by a friend! Click below to open the app, claim your 500 Coin bonus, and start earning real money! 🚀`;
    }

    bot?.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Open App & Earn', web_app: { url: finalUrl } }]
        ]
      }
    });
  });
} else {
  console.log('TELEGRAM_BOT_TOKEN is not defined in .env. Bot features are disabled.');
}


async function startServer() {
  
  // API route for health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', botActive: !!bot });
  });

  // API route for broadcasting messages
  app.post('/api/broadcast', async (req, res) => {
    const { message, users, adminId } = req.body;
    
    const envAdminId = process.env.ADMIN_TELEGRAM_ID || process.env.VITE_ADMIN_TELEGRAM_ID;

    if (!adminId || !envAdminId || adminId.toString() !== envAdminId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!bot) {
      return res.status(400).json({ error: 'Bot is not configured' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const telegramId of users) {
      try {
        await bot.sendMessage(telegramId, message);
        successCount++;
      } catch (err) {
        console.error(`Failed to send message to ${telegramId}:`, err);
        failCount++;
      }
    }

    res.json({ success: true, successCount, failCount });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
