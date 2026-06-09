const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const TOKEN = "8963238312:AAEDd6SI_uzQib29REvw1f6_4FBcJQt4VCQ";
const CHAT_ID = "8223721716";
const bot = new TelegramBot(TOKEN, { polling: true });

const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function writeOrders(data) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }

// Buyurtmani qabul qilish
app.post('/api/order', async (req, res) => {
    const { username, rate, receiptUrl, receiptCode } = req.body;
    const orderId = 'ENT-' + Math.floor(1000 + Math.random() * 9000);
    const newOrder = { id: orderId, username, rate, status: 'Kutilmoqda', account: null };
    
    let orders = readOrders();
    orders.push(newOrder);
    writeOrders(orders);

    let msg = `🛒 *YANGI BUYURTMA*\n🆔 ID: ${orderId}\n📦 Mahsulot: ${rate}\n🔢 Chek kodi: ${receiptCode || "Rasmli chek"}`;
    
    try {
        await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
        res.json({ success: true, orderId });
    } catch(e) { res.status(500).json({ success: false }); }
});

// Statusni tekshirish
app.get('/api/order-status/:id', (req, res) => {
    const orders = readOrders();
    const order = orders.find(o => o.id === req.params.id);
    res.json(order || { status: 'Topilmadi' });
});

// Admin uchun bot komandasi
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
            bot.sendMessage(CHAT_ID, "✅ Ma'lumot saqlandi va mijozga ko'rinadi!");
        }
    }
});

app.listen(PORT, () => console.log(`Server ${PORT} portda ishlamoqda!`));
