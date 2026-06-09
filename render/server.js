const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

// Node.js v24 va undan yuqori versiyalar uchun express obyektini xavfsiz yuklash
const app = express();

app.use(cors());
app.use(express.json());

// Telegram Bot Sozlamalari
const TOKEN = '8663451893:AAEhKVc4aEaerRduEdhsZZz7t__gcw-xogc'; 
const ADMIN_CHAT_ID = '8223721716'; 
const bot = new TelegramBot(TOKEN, { polling: true });

// Foydalanuvchilar va Buyurtmalar bazasi (Xotirada)
let usersDatabase = {}; 
let ordersDatabase = [];

// 1. RO'YXATDAN O'TISH ENDPOINTI
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "Username va parol majburiy!" });
    }
    const lowerUser = username.toLowerCase().trim().replace('@', '');

    if(usersDatabase[lowerUser]) {
        return res.json({ success: false, message: "Ushbu username band! Boshqasini kiriting." });
    }

    usersDatabase[lowerUser] = password;
    res.json({ success: true, message: "Ro'yxatdan o'tish muvaffaqiyatli! Endi Kirish tugmasini bosing." });
});

// 2. TIZIMGA KIRISH ENDPOINTI
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "Username va parol majburiy!" });
    }
    const lowerUser = username.toLowerCase().trim().replace('@', '');

    if(!usersDatabase[lowerUser]) {
        return res.json({ success: false, message: "Username topilmadi! Avval ro'yxatdan o'ting." });
    }

    if(usersDatabase[lowerUser] !== password) {
        return res.json({ success: false, message: "Xato parol kiritdingiz!" });
    }

    res.json({ success: true, message: "Tizimga muvaffaqiyatli kirdingiz!" });
});

// 3. BUYURTMA QABUL QILISH
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

    // Telegram Admin Xabarnomasi
    const message = `🔥 ENTELLI MARKETPLACE - YANGI BUYURTMA!\n\n` +
                    `🆔 Buyurtma ID: ${orderId}\n` +
                    `👤 Mijoz: @${username}\n` +
                    `🛒 Mahsulotlar: ${rate}\n` +
                    `🧾 Chek/Izoh: ${receiptUrl}\n\n` +
                    `⚙ Akkaunt ma'lumotlarini yuborish uchun pastdagi buyruqni bosing va login:parolni yozib yuboring:\n\n` +
                    `/send_${orderId} login:parol_shu_yerda`;
    
    bot.sendMessage(ADMIN_CHAT_ID, message);
    res.json({ success: true, order: newOrder });
});

// 4. MIJOZ BUYURTMALAR TARIXI
app.get('/api/orders/:username', (req, res) => {
    const targetUser = req.params.username.toLowerCase().trim().replace('@', '');
    const userOrders = ordersDatabase.filter(o => o.username === targetUser);
    res.json(userOrders);
});

// 5. TELEGRAM BOT ORQALI AKKAUNT YUBORISH CLONE ALGORITMI
bot.on('message', (msg) => {
    const text = msg.text;
    if (text && text.startsWith('/send_')) {
        const parts = text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        if(!accountData || accountData.includes('login:parol_shu_yerga')) {
            bot.sendMessage(ADMIN_CHAT_ID, `⚠ Xatolik! Iltimos akkaunt ma'lumotlarini to'g'ri kiriting.`);
            return;
        }

        const order = ordersDatabase.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData;
            bot.sendMessage(ADMIN_CHAT_ID, `✅ Muvaffaqiyatli! ${orderId} buyurtma egasiga yetkazildi.`);
        } else {
            bot.sendMessage(ADMIN_CHAT_ID, `❌ Buyurtma topilmadi.`);
        }
    }
});

// Render uchun tashqi IP bog'lanishi ('0.0.0.0')
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server faol port: ${PORT}`));
