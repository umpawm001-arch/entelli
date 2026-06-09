const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 🔔 TELEGRAM BOT PARAMETRLARI
const TELEGRAM_BOT_TOKEN = "8963238312:AAEDd6SI_uzQib29REvw1f6_4FBcJQt4VCQ";
const CHAT_ID = "8223721716"; // Admin ID (sizning IDingiz)

// Botni ishga tushirish
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// 📁 MA'LUMOTLAR BAZASI FAYLLARI
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Fayllar mavjud bo'lmasa, ularni yaratish
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

// Fayldan o'qish va yozish funksiyalari
function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function writeUsers(data) { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); }
function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function writeOrders(data) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }

// 1. AUTH ENDPOINTS
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    let users = readUsers();
    if(users[lowerUser]) return res.json({ success: false, message: "Username band!" });
    users[lowerUser] = password;
    writeUsers(users);
    res.json({ success: true, message: "Ro'yxatdan o'tdingiz!" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    let users = readUsers();
    if(users[lowerUser] && users[lowerUser] === password) {
        return res.json({ success: true, message: "Tizimga kirdingiz!" });
    }
    res.json({ success: false, message: "Ma'lumotlar xato!" });
});

// 2. YANGI BUYURTMA
app.post('/api/order', (req, res) => {
    const { username, rate, receiptUrl } = req.body;
    const orderId = 'ENT-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder = { id: orderId, username, rate, receipt: receiptUrl, status: 'Kutilmoqda', account: null };
    let orders = readOrders();
    orders.push(newOrder);
    writeOrders(orders);

    const message = `🛒 *YANGI BUYURTMA!*\n\n` +
                    `🆔 ID: ${orderId}\n` +
                    `👤 Mijoz: @${username}\n` +
                    `📦 Mahsulot: ${rate}\n` +
                    `🧾 [Chekni ko'rish](${receiptUrl})`;
    
    bot.sendMessage(CHAT_ID, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Qabul qilish", callback_data: `approve_${orderId}` },
                 { text: "❌ Rad etish", callback_data: `reject_${orderId}` }]
            ]
        }
    });
    res.json({ success: true, order: newOrder });
});

// 3. TELEGRAM CALLBACK
bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const orderId = data.split('_')[1];

    if (data.startsWith('approve_')) {
        bot.sendMessage(chatId, `Akkaunt ma'lumotini yuboring:\n/send_${orderId} login:parol`);
    } else if (data.startsWith('reject_')) {
        let orders = readOrders();
        const order = orders.find(o => o.id === orderId);
        if (order) { order.status = 'Rad etildi'; writeOrders(orders); }
        bot.editMessageText(`❌ ${orderId} rad etildi.`, { chat_id: chatId, message_id: query.message.message_id });
    }
    bot.answerCallbackQuery(query.id);
});

// 4. MA'LUMOT QABUL QILISH
bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/send_')) {
        const parts = msg.text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        let orders = readOrders();
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData;
            writeOrders(orders);
            bot.sendMessage(CHAT_ID, `✅ ${orderId} muvaffaqiyatli saqlandi!`);
        }
    }
});

app.listen(5000, () => console.log("Server 5000-portda ishlamoqda!"));
