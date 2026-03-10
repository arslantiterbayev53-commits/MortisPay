const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');

app.get('/', (req, res) => res.send('MortisPay 3.4 is Active!'));
app.listen(process.env.PORT || 3000);

const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; // Твой ID (Арслан)
const bot = new TelegramBot(TOKEN, { polling: true });

const dbFile = './users.json';
let db = { users: {} };

// Загрузка базы
if (fs.existsSync(dbFile)) {
    try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const LANGS = {
    RU: {
        pin: "🔐 Введите ПИН-код:",
        setup: "🔐 Создайте ПИН (4 цифры):",
        unlocked: "✅ Доступ открыт!",
        btns: ["📊 Копилка", "➕ Пополнить", "➖ Снять", "➕ Новая цель", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        pin: "🔐 PIN кодни киритинг:",
        setup: "🔐 PIN яратинг (4 рақам):",
        unlocked: "✅ Кириш очилди!",
        btns: ["📊 Копилка", "➕ Тўлдириш", "➖ Ечиш", "➕ Янги мақсад", "🗑 Ўчириш", "💹 Курслар", "🌐 Тил", "🔒 Блок"]
    }
};

const states = {}; // Для хранения шагов (State Machine)

function getMenu(id) {
    const u = db.users[id];
    const b = LANGS[u.lang].btns;
    return { reply_markup: { keyboard: [[b[0]], [b[1], b[2]], [b[3], b[4]], [b[5], b[6]], [b[7]]], resize_keyboard: true } };
}

// Уведомление в 08:00
cron.schedule('0 8 * * *', () => {
    Object.keys(db.users).forEach(uId => {
        const lang = db.users[uId].lang || "RU";
        bot.sendMessage(uId, lang === "RU" ? "☀️ Пора пополнить копилку!" : "☀️ Копилкани тўлдириш вақти!");
    });
}, { timezone: "Asia/Tashkent" });

bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // Регистрация
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, username: msg.from.username, goals: [], lang: "RU", pin: null, locked: true };
        saveDB();
        return bot.sendMessage(id, "Выберите язык / Тилни танланг:", { reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true } });
    }

    const u = db.users[id];

    // Смена языка (Исправлено)
    if (text === "🇺🇿 UZ" || text === "🇷🇺 RU" || text === "🌐 Тил" || text === "🌐 Язык") {
        u.lang = text.includes("UZ") ? "UZ" : "RU";
        saveDB();
        return bot.sendMessage(id, u.lang === "RU" ? "Язык: RU 🇷🇺" : "Тил: UZ 🇺🇿", getMenu(id));
    }

    // ПИН-код
    if (!u.pin) {
        if (text.length === 4 && !isNaN(text)) {
            u.pin = text; u.locked = false; saveDB();
            return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id));
        }
        return bot.sendMessage(id, LANGS[u.lang].setup);
    }

    if (u.locked) {
        if (text === u.pin) { u.locked = false; saveDB(); return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id)); }
        return bot.sendMessage(id, LANGS[u.lang].pin);
    }

    // ================= 👑 АДМИН ПАНЕЛЬ (10 КОМАНД) =================
    if (id === MY_ID) {
        if (text === "/admin") {
            return bot.sendMessage(id, "👑 *ADMIN PANEL*:\n\n1. `/users` - Все юзеры\n2. `/db` - Файл базы\n3. `/send [текст]` - Рассылка\n4. `/reset [id]` - Сброс ПИН\n5. `/stats` - Статистика\n6. `/clear` - Удалить пустых\n7. `/total` - Общий банк\n8. `/ban [id]`\n9. `/unban [id]`\n10. `/remind` - Пнуть всех", { parse_mode: "Markdown" });
        }
        if (text === "/users") {
            let s = "👥 *Юзеры:*\n";
            Object.values(db.users).forEach(usr => s += `• ${usr.name} (ID: \`${usr.id}\`) PIN: ${usr.pin}\n`);
            return bot.sendMessage(id, s, { parse_mode: "Markdown" });
        }
        if (text === "/db") return bot.sendDocument(id, dbFile);
        if (text.startsWith("/send ")) {
            const m = text.replace("/send ", "");
            Object.keys(db.users).forEach(uId => bot.sendMessage(uId, `📢 *ОПОВЕЩЕНИЕ:* ${m}`));
            return bot.sendMessage(id, "✅ Рассылка готова.");
        }
        if (text === "/total") {
            let sum = 0; Object.values(db.users).forEach(usr => usr.goals.forEach(g => sum += g.collected));
            return bot.sendMessage(id, `💰 Всего в копилках: ${sum} UZS`);
        }
    }

    // ================= 💰 КОПИЛКА (STATE MACHINE) =================
    const L = LANGS[u.lang];

    if (states[id]) {
        const s = states[id];
        if (s.type === 'title') {
            s.title = text; s.type = 'goal';
            return bot.sendMessage(id, "Введите сумму цели / Summani yozing:");
        }
        if (s.type === 'goal') {
            u.goals.push({ title: s.title, goal: Number(text), collected: 0 });
            delete states[id]; saveDB();
            return bot.sendMessage(id, "✅", getMenu(id));
        }
        if (s.type === 'add') {
            const g = u.goals[s.idx];
            if (g && !isNaN(text)) {
                g.collected += Number(text); delete states[id]; saveDB();
                bot.sendMessage(MY_ID, `💰 LOG: ${u.name} +${text} (${g.title})`);
                return bot.sendMessage(id, `✅ +${text}`, getMenu(id));
            }
        }
        if (s.type === 'sub') {
            const g = u.goals[s.idx];
            if (g && !isNaN(text)) {
                g.collected -= Number(text); delete states[id]; saveDB();
                bot.sendMessage(MY_ID, `💸 LOG: ${u.name} -${text} (${g.title})`);
                return bot.sendMessage(id, `➖ -${text}`, getMenu(id));
            }
        }
    }

    if (text === L.btns[0]) { // Прогресс
        let res = "🎯 *Virtual Kopilka:*\n";
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            res += `\n${i+1}. *${g.title}*\n📈 ${p}% (${g.collected}/${g.goal})`;
        });
        bot.sendMessage(id, res || L.noGoals, { parse_mode: "Markdown" });
    }

    if (text === L.btns[1]) { // +
        let l = ""; u.goals.forEach((g, i) => l += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, l + "\nНомер цели:").then(() => states[id] = { type: 'sel_add' });
    }
    if (text === L.btns[2]) { // -
        let l = ""; u.goals.forEach((g, i) => l += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, l + "\nНомер цели:").then(() => states[id] = { type: 'sel_sub' });
    }
    
    // Обработка выбора номера
    if (!isNaN(text) && states[id]) {
        if (states[id].type === 'sel_add') {
            states[id] = { type: 'add', idx: parseInt(text)-1 };
            return bot.sendMessage(id, "Сумма:");
        }
        if (states[id].type === 'sel_sub') {
            states[id] = { type: 'sub', idx: parseInt(text)-1 };
            return bot.sendMessage(id, "Сколько снять?");
        }
    }

    if (text === L.btns[3]) { states[id] = { type: 'title' }; bot.sendMessage(id, "Название:"); }
    if (text === L.btns[5]) { 
        const r = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
        bot.sendMessage(id, `🇺🇸 1 USD = ${r.data[0].Rate} UZS`);
    }
    if (text === L.btns[7]) { u.locked = true; saveDB(); bot.sendMessage(id, "🔒", { reply_markup: { remove_keyboard: true } }); }
});