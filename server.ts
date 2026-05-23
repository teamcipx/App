import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Telegram Bot if Token is provided
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;
if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram Bot started with polling.');
  
  bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match ? match[1] : null;
    
    // In Telegram Web Apps, the startapp parameter is passed in the URL.
    const appUrl = process.env.VITE_APP_URL || 'https://nxpost.online'; 
    const finalUrl = startParam ? `${appUrl}?startapp=${startParam}` : appUrl;
    
    let welcomeMessage = `🎉 xN Coin Bot-এ আপনাকে স্বাগতম! 🪙\n\nবিজ্ঞাপন দেখুন, টাস্ক পূরণ করুন এবং খুব সহজেই কয়েন আয় করুন! আপনার কয়েনগুলোকে আসল টাকায় রূপান্তর করুন।\n\nনিচের বাটনে ক্লিক করে এখনই আয় করা শুরু করুন! 🚀`;

    if (startParam) {
      welcomeMessage = `🎉 xN Coin Bot-এ আপনাকে স্বাগতম! 🪙\n\nআপনি একজন বন্ধুর রেফারেন্স দিয়ে যুক্ত হয়েছেন! অ্যাপটি খুলতে, আপনার ৫০০ কয়েন বোনাস সংগ্রহ করতে এবং আসল টাকা আয় শুরু করতে নিচের বাটনে ক্লিক করুন! 🚀`;
    }

    if (supabase) {
      try {
        const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', chatId).single();
        if (!existingUser) {
          const today = new Date().toISOString().split('T')[0];
          let initialBalance = 0;
          let referredBy = null;

          if (startParam && startParam !== chatId.toString()) {
            const referrerId = Number(startParam);
            if (!isNaN(referrerId)) {
              const { data: referrer } = await supabase.from('users').select('*').eq('telegram_id', referrerId).single();
              if (referrer) {
                // Reward referrer
                await supabase.from('users').update({ balance: referrer.balance + 500 }).eq('telegram_id', referrerId);
                initialBalance = 500;
                referredBy = referrerId;
                
                // Send Telegram message to referrer
                bot?.sendMessage(referrerId, `🎉 *নতুন রেফারেল!*\n\nকেউ মাত্র আপনার লিংক ব্যবহার করে যুক্ত হয়েছে। আপনি ৫০০ কয়েন পেয়েছেন! 💰`, { parse_mode: 'Markdown' }).catch(console.error);
              }
            }
          }


          const newUser: any = {
            telegram_id: chatId,
            balance: initialBalance,
            ads_watched_today: 0,
            last_ad_date: today
          };

          if (referredBy) newUser.referred_by = referredBy;

          const { error: insertError } = await supabase.from('users').insert([newUser]);
          if (insertError && insertError.code !== '23505') {
            // Fallback without referred_by if column missing
            if (newUser.referred_by !== undefined) {
              delete newUser.referred_by;
              await supabase.from('users').insert([newUser]);
            }
          }
        }
      } catch (err) {
        console.error('Error handling start referral:', err);
      }
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
    const { message, users, adminId, buttonText, buttonUrl } = req.body;
    
    const envAdminId = process.env.ADMIN_TELEGRAM_ID || process.env.VITE_ADMIN_TELEGRAM_ID;

    if (!adminId || !envAdminId || adminId.toString() !== envAdminId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!bot) {
      return res.status(400).json({ error: 'Bot is not configured' });
    }

    let successCount = 0;
    let failCount = 0;

    const options: any = {};
    if (buttonText && buttonUrl) {
      let finalUrl = buttonUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl) && !/^tg:\/\//i.test(finalUrl)) {
         finalUrl = 'https://' + finalUrl;
      }
      options.reply_markup = {
        inline_keyboard: [
          [{ text: buttonText, url: finalUrl }]
        ]
      };
    }

    for (const telegramId of users) {
      try {
        await bot.sendMessage(telegramId, message, options);
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
