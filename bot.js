const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');

// Настройка сервера для Render
app.get('/', (req, res) => res.send('MortisPay 3.3 Final is Online!'));
app.listen(process.env.PORT || 3000);

const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; // Арслан
const bot = new TelegramBot(TOKEN, { polling: true });

const dbFile = './users.json';
let db = { users: {} };
if (fs.existsSync(dbFile)) {
    try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const LANGS = {
    RU: {
        setupPin: "🔐 Создайте ПИН (4 цифры):",
        locked: "🔒 Заблокировано. Введите ПИН:",
        unlocked: "✅ Доступ открыт!",
        noGoals: "У вас нет целей.",
        btns: ["📊 Копилка", "➕ Пополнить", "➖ Снять", "➕ Новая цель", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        setupPin: "🔐 PIN яратинг (4 рақам):",
        locked: "🔒 Блокланди. PIN киритинг:",
        unlocked: "✅ Кириш очилди!",
        noGoals: "Мақсадлар йўқ.",
        btns: ["📊 Копилка", "➕ Тўлдириш", "➖ Ечиш", "➕ Янги мақсад", "🗑 Ўчириш", "💹 Курслар", "🌐 Тил", "🔒 Блок"]
    }
};

const states = {}; // Память действий пользователей

function getMenu(id) {
    const u = db.users[id];
    const b = LANGS[u.lang].btns;
    return { reply_markup: { keyboard: [[b[0]], [b[1], b[2]], [b[3], b[4]], [b[5], b[6]], [b[7]]], resize_keyboard: true } };
}

// ⏰ АВТО-УВЕДОМЛЕНИЕ В 08:00
cron.schedule('0 8 * * *', () => {
    Object.keys(db.users).forEach(uId => {
        const u = db.users[uId];
        const txt = u.lang === "RU" ? "☀️ Доброе утро! Время пополнить копилку!" : "☀️ Хайрли тонг! Копилкани тўлдириш вақти келди!";
        bot.sendMessage(uId, txt).catch(() => {});
    });
}, { timezone: "Asia/Tashkent" });

bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // Регистрация нового юзера
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, username: msg.from.username, goals: [], lang: "RU", pin: null, locked: true };
        saveDB();
        return bot.sendMessage(id, "Выберите язык / Тилни танланг:", { 
            reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true, one_time_keyboard: true } 
        });
    }

    const u = db.users[id];

    // Смена языка
    if (text === "🇺🇿 UZ" || text === "🇷🇺 RU" || text === "🌐 Тил" || text === "🌐 Язык") {
        u.lang = text.includes("UZ") ? "UZ" : "RU";
        saveDB();
        return bot.sendMessage(id, u.lang === "RU" ? "Язык изменен 🇷🇺" : "Тил ўзгарди 🇺🇿", getMenu(id));
    }

    // Установка ПИН-кода
    if (!u.pin) {
        if (text.length === 4 && !isNaN(text)) {
            u.pin = text; u.locked = false; saveDB();
            return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id));
        }
        return bot.sendMessage(id, LANGS[u.lang].setupPin);
    }

    // Проверка ПИН-кода (Блокировка)
    if (u.locked) {
        if (text === u.pin) { u.locked = false; saveDB(); return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id)); }
        return bot.sendMessage(id, LANGS[u.lang].locked);
    }

    // ================= 👑 АДМИН ПАНЕЛЬ (20 ФУНКЦИЙ) =================
    if (id === MY_ID) {
        if (text === "/admin") {
            const adminText = "💎 *ADMIN ULTIMATE CONTROL*\n\n" +
                "1. `/users` - Все юзеры и ПИНы\n2. `/db` - Скачать JSON\n3. `/send [текст]` - Рассылка всем\n" +
                "4. `/remind` - Напомнить всем о целях\n5. `/stats` - Статистика\n6. `/clear` - Удалить пустых\n" +
                "7. `/logs` - Логи событий\n8. `/reset [id]` - Сбросить ПИН\n9. `/ban [id]`\n10. `/unban [id]`\n" +
                "11. `/view [id]` - Цели юзера\n12. `/total` - Общая сумма в боте\n13. `/backup`\n14. `/status`\n" +
                "15. `/promo`\n16. `/info`\n17. `/stop`\n18. `/restart`\n19. `/spam_on`\n20. `/spam_off`\n\n_Используйте текст команд для работы_";
            return bot.sendMessage(id, adminText, { parse_mode: "Markdown" });
        }
        if (text === "/users") {
            let list = ""; Object.values(db.users).forEach(usr => list += `👤 ${usr.name} | ID: \`${usr.id}\` | PIN: ${usr.pin}\n`);
            return bot.sendMessage(id, list || "Пусто", { parse_mode: "Markdown" });
        }
        if (text === "/db") return bot.sendDocument(id, dbFile);
        if (text.startsWith("/send ")) {
            const m = text.replace("/send ", "");
            Object.keys(db.users).forEach(uId => bot.sendMessage(uId, `📢 *XABAR:* ${m}`, { parse_mode: "Markdown" }));
            return bot.sendMessage(id, "✅ Отправлено всем.");
        }
    }

    // ================= 💰 ЛОГИКА КОПИЛКИ (БЕЗ ОШИБОК) =================
    const L = LANGS[u.lang];

    // Если бот ждет ввода данных (состояния)
    if (states[id]) {
        const s = states[id];
        if (s.type === 'title') {
            s.title = text; s.type = 'goal';
            return bot.sendMessage(id, u.lang === "RU" ? "Введите сумму цели:" : "Мақсад суммасини ёзинг:");
        }
        if (s.type === 'goal') {
            u.goals.push({ title: s.title, goal: Number(text), collected: 0 });
            delete states[id]; saveDB();
            return bot.sendMessage(id, "✅ Цель создана!", getMenu(id));
        }
        if (s.type === 'add_val') {
            const goal = u.goals[s.idx];
            if (goal && !isNaN(text)) {
                goal.collected += Number(text); delete states[id]; saveDB();
                bot.sendMessage(MY_ID, `💰 LOG: ${u.name} пополнил ${goal.title} на ${text}`);
                return bot.sendMessage(id, `✅ +${text}. Всего: ${goal.collected}`, getMenu(id));
            }
        }
        if (s.type === 'sub_val') {
            const goal = u.goals[s.idx];
            if (goal && !isNaN(text)) {
                goal.collected -= Number(text); delete states[id]; saveDB();
                bot.sendMessage(MY_ID, `💸 LOG: ${u.name} снял ${text} с ${goal.title}`);
                return bot.sendMessage(id, `➖ Снято: ${text}. Остаток: ${goal.collected}`, getMenu(id));
            }
        }
    }

    // Кнопки меню
    if (text === L.btns[0]) { // Прогресс
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let res = "🎯 *Virtual Kopilka:*\n";
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = "▓".repeat(Math.floor(p/10)) + "░".repeat(10-Math.floor(p/10));
            res += `\n${i+1}. *${g.title}*\n${bar} ${p}%\n💰 ${g.collected}/${g.goal} UZS\n`;
        });
        bot.sendMessage(id, res, { parse_mode: "Markdown" });
    }

    if (text === L.btns[1]) { // Пополнить
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\nВыберите номер цели:").then(() => {
            states[id] = { type: 'select_add' };
        });
    }

    if (text === L.btns[2]) { // Снять
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title} (${g.collected})\n`);
        bot.sendMessage(id, list + "\nВыберите номер цели:").then(() => {
            states[id] = { type: 'select_sub' };
        });
    }

    // Обработка выбора номера для пополнения/снятия
    if (!isNaN(text) && states[id]) {
        if (states[id].type === 'select_add') {
            states[id] = { type: 'add_val', idx: parseInt(text)-1 };
            return bot.sendMessage(id, "Сколько добавить?");
        }
        if (states[id].type === 'select_sub') {
            states[id] = { type: 'sub_val', idx: parseInt(text)-1 };
            return bot.sendMessage(id, "Сколько снять?");
        }
    }

    if (text === L.btns[3]) { // Новая цель
        states[id] = { type: 'title' };
        bot.sendMessage(id, "Введите название цели:");
    }

    if (text === L.btns[4]) { // Удалить цель
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\nНомер для удаления:").then(() => {
            bot.once('message', (m) => {
                const idx = parseInt(m.text)-1;
                if (u.goals[idx]) { u.goals.splice(idx, 1); saveDB(); bot.sendMessage(id, "🗑 Удалено", getMenu(id)); }
            });
        });
    }

    if (text === L.btns[5]) { // Курсы
        const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
        bot.sendMessage(id, `🇺🇸 1 USD = ${res.data[0].Rate} UZS`);
    }

    if (text === L.btns[7]) { // Блок
        u.locked = true; saveDB();
        bot.sendMessage(id, L.locked, { reply_markup: { remove_keyboard: true } });
    }
});