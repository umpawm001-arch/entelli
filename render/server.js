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
const CHAT_ID = "8223721716";
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// 📁 BAZA FAYLLARI
const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function writeOrders(data) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }

// 1. YANGI BUYURTMA YARATISH (Rasm bilan)
app.post('/api/order', async (req, res) => {
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

    try {
        // Botga rasmli xabar yuborish
        await bot.sendPhoto(CHAT_ID, receiptUrl, {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Qabul qilish", callback_data: `approve_${orderId}` },
                     { text: "❌ Rad etish", callback_data: `reject_${orderId}` }]
                ]
            }
        });
        res.json({ success: true, order: newOrder });
    } catch (e) {
        res.status(500).json({ success: false, message: "Botga yuborishda xatolik" });
    }
});

// 2. TELEGRAM CALLBACK (Admin tugmalari)
bot.on('callback_query', (query) => {
    const data = query.data;
    const orderId = data.split('_')[1];

    if (data.startsWith('approve_')) {
        bot.sendMessage(CHAT_ID, `✉ *${orderId}* uchun login/parolni yuboring:\n\n\`/send_${orderId} login:parol\``, { parse_mode: 'Markdown' });
    } else if (data.startsWith('reject_')) {
        let orders = readOrders();
        let order = orders.find(o => o.id === orderId);
        if (order) { order.status = 'Rad etildi'; writeOrders(orders); }
        bot.editMessageText(`❌ ${orderId} rad etildi.`, { chat_id: CHAT_ID, message_id: query.message.message_id });
    }
    bot.answerCallbackQuery(query.id);
});

// 3. MA'LUMOT QABUL QILISH
bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/send_')) {
        const parts = msg.text.split(' ');
        const orderId = parts[0].replace('/send_', '');
        const accountData = parts.slice(1).join(' ');

        let orders = readOrders();
        let order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = 'Yetkazildi';
            order.account = accountData;
            writeOrders(orders);
            bot.sendMessage(CHAT_ID, `✅ *${orderId}* muvaffaqiyatli yetkazildi!`, { parse_mode: 'Markdown' });
        }
    }
});

app.listen(5000, () => console.log("Server 5000-portda ishlamoqda!"));
