const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 🔔 TELEGRAM BOT PARAMETRLARI
const TOKEN = '8663451893:AAEhKVc4aEaerRduEdhsZZz7t__gcw-xogc'; 
const ADMIN_CHAT_ID = '8223721716'; 
const bot = new TelegramBot(TOKEN, { polling: true });

// 📁 MA'LUMOTLAR BAZASI FAYLLARI
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Fayllar mavjud bo'lmasa, ularni yaratish
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

// Fayldan ma'lumotlarni o'qish funksiyalari
function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function writeUsers(data) { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); }
function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function writeOrders(data) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }

// 1. AUTH ENDPOINTS
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: "Maydonlarni to'ldiring!" });
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    
    let users = readUsers();
    if(users[lowerUser]) return res.json({ success: false, message: "Ushbu username band!" });
    
    users[lowerUser] = password;
    writeUsers(users);
    res.json({ success: true, message: "Ro'yxatdan o'tish muvaffaqiyatli!" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim().replace('@', '');
    let users = readUsers();
    
    if(users[lowerUser] && users[lowerUser] === password) {
        return res.json({ success: true, message: "Tizimga kirdingiz!" });
    }
    res.json({ success: false, message: "Username yoki parol xato!" });
});

// 2. YANGI BUYURTMA
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

    let orders = readOrders();
    orders.push(newOrder);
    writeOrders(orders);

    const message = `🛒 ENTELLI MARKETPLACE - YANGI BUYURTMA!\n\n` +
                    `🆔 ID: ${orderId}\n` +
                    `👤 Mijoz: @${username}\n` +
                    `📦 Mahsulot: ${rate}\n` +
                    `🧾 Chek havolasi: ${receiptUrl}`;
    
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Qabul qilish", callback_data: `approve_${orderId}` },
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
    let orders = readOrders();
    const userOrders = orders.filter(o => o.username === targetUser);
    res.json(userOrders);
});

// 3. TELEGRAM CALLBACK (TUGMALAR)
bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (data.startsWith('approve_')) {
        const orderId = data.replace('approve_', '');
        bot.sendMessage(chatId, `✉ **${orderId}** uchun akkaunt ma'lumotlarini pastdagi formatda yuboring:\n\n\`/send_${orderId} login:parol\``, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(query.id);
    } 
    
    if (data.startsWith('reject_')) {
        const orderId = data.replace('reject_', '');
        let orders = readOrders();
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = 'Rad etildi';
            writeOrders(orders);
            bot.editMessageText(`❌ Buyurtma ${orderId} admin tomonidan rad etildi.`, { chat_id: chatId, message_id: messageId });
        }
        bot.answerCallbackQuery(query.id);
    }
});

// AKKAUNT MA'LUMOTLARINI QABUL QILISH VA FAYLGA YOZISH
bot.on('message', (msg) => {
    const text = msg.text;
    if (text && text.startsWith('/send_')) {
        const parts = text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        if(!accountData) {
            bot.sendMessage(ADMIN_CHAT_ID, `⚠ Xato! Ma'lumotlarni yozmadingiz.`);
            return;
        }

        let orders = readOrders();
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData; // Ma'lumot faylga yoziladi
            writeOrders(orders);
            bot.sendMessage(ADMIN_CHAT_ID, `✅ Tayyor! ${orderId} buyurtma muvaffaqiyatli faylga saqlandi va mijozga yetkazildi.`);
        } else {
            bot.sendMessage(ADMIN_CHAT_ID, `❌ Buyurtma topilmadi.`);
        }
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server faol: ${PORT}`));
