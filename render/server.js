const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// 🔔 TELEGRAM BOT PARAMETRLARI
const TOKEN = '8663451893:AAEhKVc4aEaerRduEdhsZZz7t__gcw-xogc'; 
const ADMIN_CHAT_ID = '8223721716'; 
const bot = new TelegramBot(TOKEN, { polling: true });

let usersDatabase = {}; 
let ordersDatabase = [];

// 1. AUTH ENDPOINTS
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: "Maydonlarni to'ldiring!" });
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    if(usersDatabase[lowerUser]) return res.json({ success: false, message: "Ushbu username band!" });
    
    usersDatabase[lowerUser] = password;
    res.json({ success: true, message: "Ro'yxatdan o'tish muvaffaqiyatli!" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    if(usersDatabase[lowerUser] && usersDatabase[lowerUser] === password) {
        return res.json({ success: true, message: "Tizimga kirdingiz!" });
    }
    res.json({ success: false, message: "Username yoki parol xato!" });
});

// 2. YANGI BUYURTMA (INLINE TUGMALAR BILAN)
app.post('/api/order', (req, res) => {
    const { username, rate, receiptUrl } = req.body;
    const orderId = 'ENT-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder = {
        id: orderId,
        username: username.toLowerCase().trim().replace('@', ''),
        rate: rate,
        receipt: receiptUrl,
        status: 'Kutilmoqda',
        account: null
    };

    ordersDatabase.push(newOrder);

    // Admin uchun Telegram xabari formatlash
    const message = `🛒 ENTELLI MARKETPLACE - YANGI BUYURTMA!\n\n` +
                    `🆔 ID: ${orderId}\n` +
                    `👤 Mijoz: @${username}\n` +
                    `📦 Mahsulot: ${rate}\n` +
                    `🧾 Chek havolasi: ${receiptUrl}`;
    
    // Telegramda Tasdiqlash va Rad etish tugmalarini chiqarish
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Qabul qilish (Akkaunt yuborish)", callback_data: `approve_${orderId}` },
                    { text: "❌ Rad etish", callback_data: `reject_${orderId}` }
                ]
            ]
        }
    };
    
    bot.sendMessage(ADMIN_CHAT_ID, message, options);
    res.json({ success: true, order: newOrder });
});

app.get('/api/orders/:username', (req, res) => {
    const targetUser = req.params.username.toLowerCase().trim().replace('@', '');
    const userOrders = ordersDatabase.filter(o => o.username === targetUser);
    res.json(userOrders);
});

// 3. ADMIN TUGMALARINI BOSGANDA ISHLAYDIGAN ALGORITM
bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (data.startsWith('approve_')) {
        const orderId = data.replace('approve_', '');
        
        // Admin akkaunt login:parolini yuborishi uchun vaqtinchalik buyruq holatiga o'tkaziladi
        bot.sendMessage(chatId, `✉ Loyiha ID: ${orderId} uchun akkaunt ma'lumotlarini (Login:Parol) formatida yozib yuboring.\n\nMisol uchun:\n/send_${orderId} pablo:secret123`);
        bot.answerCallbackQuery(query.id);
    } 
    
    if (data.startsWith('reject_')) {
        const orderId = data.replace('reject_', '');
        const order = ordersDatabase.find(o => o.id === orderId);
        if (order) {
            order.status = 'Rad etildi';
            bot.editMessageText(`❌ Buyurtma ${orderId} admin tomonidan rad etildi.`, { chat_id: chatId, message_id: messageId });
        }
        bot.answerCallbackQuery(query.id);
    }
});

// Akkaunt ma'lumotlarini qabul qilib mijozga yetkazish
bot.on('message', (msg) => {
    const text = msg.text;
    if (text && text.startsWith('/send_')) {
        const parts = text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        if(!accountData) {
            bot.sendMessage(ADMIN_CHAT_ID, `⚠ Xato! Akkaunt ma'lumotlarini yozmadingiz.`);
            return;
        }

        const order = ordersDatabase.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData;
            bot.sendMessage(ADMIN_CHAT_ID, `✅ Tayyor! ${orderId} buyurtma muvaffaqiyatli yetkazildi va foydalanuvchi panelida yangilandi.`);
        } else {
            bot.sendMessage(ADMIN_CHAT_ID, `❌ Buyurtma topilmadi.`);
        }
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server faol: ${PORT}`));
