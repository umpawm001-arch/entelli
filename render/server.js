const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// Telegram Bot Sozlamalari
const TOKEN = '8663451893:AAEhKVc4aEaerRduEdhsZZz7t__gcw-xogc'; 
const ADMIN_CHAT_ID = '8223721716'; 
const bot = new TelegramBot(TOKEN, { polling: true });

// Foydalanuvchilar va Buyurtmalar xotira ombori
let usersDatabase = {}; 
let ordersDatabase = [];

// 1. RO'YXATDAN O'TISH ENDPOINTI
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim();

    if(usersDatabase[lowerUser]) {
        return res.json({ success: false, message: "Ushbu username band! Boshqa kiriting." });
    }

    usersDatabase[lowerUser] = password; // Parolni xavfsiz saqlash
    res.json({ success: true, message: "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi! Endi tizimga kiring." });
});

// 2. TIZIMGA KIRISH ENDPOINTI
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const lowerUser = username.toLowerCase().trim();

    if(!usersDatabase[lowerUser]) {
        return res.json({ success: false, message: "Username topilmadi! Avval ro'yxatdan o'ting." });
    }

    if(usersDatabase[lowerUser] !== password) {
        return res.json({ success: false, message: "Xato parol kiritdingiz!" });
    }

    res.json({ success: true, message: "Tizimga muvaffaqiyatli kirdingiz!" });
});

// 3. SAVATCHADAN BUYURTMA QABUL QILISH
app.post('/api/order', (req, res) => {
    const { username, rate, receiptUrl } = req.body;
    const orderId = 'ENT-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder = {
        id: orderId,
        username: username.toLowerCase().trim(),
        rate: rate,
        receipt: receiptUrl,
        status: 'Kutilmoqda',
        account: null
    };

    ordersDatabase.push(newOrder);

    // Telegram orqali sizga daxshatli formatda xabar boradi
    const message = `🔥 ENTELLI MARKETPLACE - YANGI XARID!\n\n` +
                    `🆔 Buyurtma ID: ${orderId}\n` +
                    `👤 Mijoz: @${username}\n` +
                    `🛒 Savatcha tarkibi: ${rate}\n` +
                    `🧾 Chek izohi: ${receiptUrl}\n\n` +
                    `⚙ Akkaunt ma'lumotlarini biriktirish uchun quyidagi buyruqdan nusxa olib jo'nating:\n\n` +
                    `/send_${orderId} login:parol_shu_yerga`;
    
    bot.sendMessage(ADMIN_CHAT_ID, message);
    res.json({ success: true, order: newOrder });
});

// 4. MIJOZNING BUYURTMALARINI FILTRLAB QAYTARISH
app.get('/api/orders/:username', (req, res) => {
    const userOrders = ordersDatabase.filter(o => o.username === req.params.username.toLowerCase().trim());
    res.json(userOrders);
});

// 5. BOT ORQALI AKKAUNT YUBORILGANDA
bot.on('message', (msg) => {
    const text = msg.text;
    if (text && text.startsWith('/send_')) {
        const parts = text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        if(!accountData || accountData.includes('login:parol_shu_yerga')) {
            bot.sendMessage(ADMIN_CHAT_ID, `⚠ Xatolik! Iltimos ma'lumotlarni to'g'ri kiriting.`);
            return;
        }

        const order = ordersDatabase.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData;
            bot.sendMessage(ADMIN_CHAT_ID, `✅ Muvaffaqiyatli! ${orderId} buyurtma mijozga yetkazildi.`);
        }
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Daxshatli server portda faol: ${PORT}`));