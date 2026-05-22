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
  
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    const appUrl = process.env.APP_URL || 'https://example.com'; 
    // Usually you'd put the TMA link here
    
    bot?.sendMessage(chatId, 'Welcome to xN Coin Bot! Click below to open the app and earn coins.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Open App', web_app: { url: appUrl } }]
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
