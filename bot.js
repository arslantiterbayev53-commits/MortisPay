const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');

// Server Render учун
app.get('/', (req, res) => res.send('MortisPay 3.1 Ultimate is LIVE!'));
app.listen(process.env.PORT || 3000);

const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; // Арсланнинг ID
const bot = new TelegramBot(TOKEN, { polling: true });

const dbFile = './users.json';
let db = { users: {} };

// Маълумотларни юклаш
if (fs.existsSync(dbFile)) {
    try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const LANGS = {
    RU: {
        setupPin: "🔐 Создайте ПИН (4 цифры):",
        locked: "🔒 Заблокировано. Введите ПИН:",
        unlocked: "✅ Доступ открыт!",
        btns: ["📊 Копилка", "➕ Пополнить", "➖ Снять", "➕ Новая цель", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        setupPin: "🔐 PIN яратинг (4 рақам):",
        locked: "🔒 Блокланди. PIN киритинг:",
        unlocked: "✅ Кириш очилди!",
        btns: ["📊 Копилка", "➕ Тўлдириш", "➖ Ечиш", "➕ Янги мақсад", "🗑 Ўчириш", "💹 Курслар", "🌐 Тил", "🔒 Блок"]
    }
};

// Админ меню командалари
const adminMenu = {
    reply_markup: {
        keyboard: [
            ["👥 Пользователи", "📊 Статистика"],
            ["📢 Рассылка", "📂 Скачать DB"],
            ["🧹 Очистить пустых", "🔙 Главное меню"]
        ],
        resize_keyboard: true
    }
};

function getMenu(id) {
    const u = db.users[id];
    if (!u || u.locked || !u.pin) return { reply_markup: { remove_keyboard: true } };
    const b = LANGS[u.lang].btns;
    return { reply_markup: { keyboard: [[b[0]], [b[1], b[2]], [b[3], b[4]], [b[5], b[6]], [b[7]]], resize_keyboard: true } };
}

// ⏰ ХАР КУНИ СОАТ 08:00 ДА ЭСЛАТМА
cron.schedule('0 8 * * *', () => {
    Object.keys(db.users).forEach(uId => {
        bot.sendMessage(uId, "☀️ Хайрли тонг! Бугун виртуал копилкангизга пул солишни унутманг! 💰").catch(()=>{});
    });
}, { timezone: "Asia/Tashkent" });

bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // 🕵️ ХАММА ХАРАКАТЛАРНИ АДМИНГА ЛОГ ҚИЛИШ
    if (id !== MY_ID && db.users[id]) {
        bot.sendMessage(MY_ID, `👁 LOG: ${msg.from.first_name} (@${msg.from.username || 'no'}) -> ${text}`);
    }

    // Регистрация
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, username: msg.from.username, goals: [], lang: null, pin: null, locked: true };
        saveDB();
        return bot.sendMessage(id, "Tilni tanlang / Выберите язык:", { 
            reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true } 
        });
    }

    const u = db.users[id];

    // Тил ва ПИН созламалари
    if (!u.lang) {
        u.lang = text.includes("RU") ? "RU" : "UZ";
        saveDB(); return bot.sendMessage(id, LANGS[u.lang].setupPin);
    }
    if (!u.pin) {
        if (text.length === 4 && !isNaN(text)) {
            u.pin = text; u.locked = false; saveDB();
            return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id));
        }
        return bot.sendMessage(id, "4 та рақам киритинг!");
    }

    // ПИН текшируви
    if (u.locked) {
        if (text === u.pin) { u.locked = false; saveDB(); return bot.sendMessage(id, LANGS[u.lang].unlocked, getMenu(id)); }
        return bot.sendMessage(id, LANGS[u.lang].locked);
    }

    // ================= 👑 АДМИН ПАНЕЛЬ (ФАҚАТ СЕН УЧУН) =================
    if (id === MY_ID) {
        if (text === "/admin" || text === "🔙 Главное меню") {
            return bot.sendMessage(id, "👑 Добро пожаловать, Арслан! Выберите команду:", adminMenu);
        }
        if (text === "👥 Пользователи") {
            let list = "👥 *Список пользователей:*\n\n";
            Object.values(db.users).forEach(usr => list += `👤 ${usr.name} (@${usr.username})\nID: \`${usr.id}\` | PIN: ${usr.pin}\n---\n`);
            return bot.sendMessage(id, list, { parse_mode: "Markdown" });
        }
        if (text === "📊 Статистика") {
            const totalUsers = Object.keys(db.users).length;
            bot.sendMessage(id, `📈 *Статистика бот:* \n\nВсего юзеров: ${totalUsers}\nБот работает стабильно!`, { parse_mode: "Markdown" });
        }
        if (text === "📂 Скачать DB") return bot.sendDocument(id, dbFile);
        if (text === "📢 Рассылка") {
            return bot.sendMessage(id, "Для рассылки напишите: `/send ТЕКСТ`", { parse_mode: "Markdown" });
        }
        if (text.startsWith("/send ")) {
            const m = text.replace("/send ", "");
            Object.keys(db.users).forEach(uId => bot.sendMessage(uId, `📢 *XABAR:* ${m}`, { parse_mode: "Markdown" }));
            return bot.sendMessage(id, "✅ Рассылка завершена!");
        }
        if (text === "🧹 Очистить пустых") {
            let count = 0;
            for (let key in db.users) {
                if (db.users[key].goals.length === 0 && key !== MY_ID) { delete db.users[key]; count++; }
            }
            saveDB();
            return bot.sendMessage(id, `🧹 Удалено ${count} неактивных юзеров.`);
        }
    }

    // ================= 💰 КОПИЛКА ФУНКЦИЯЛАРИ =================
    const L = LANGS[u.lang];

    if (text === L.btns[0]) { // Прогресс
        if (!u.goals.length) return bot.sendMessage(id, "Ҳозирча мақсадлар йўқ.");
        let res = "🎯 *Виртуал Копилка:*\n";
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = "▓".repeat(Math.floor(p/10)) + "░".repeat(10-Math.floor(p/10));
            res += `\n${i+1}. *${g.title}*\n${bar} ${p}%\n💰 ${g.collected} / ${g.goal} UZS\n`;
        });
        bot.sendMessage(id, res, { parse_mode: "Markdown" });
    }

    if (text === L.btns[1]) { // Тўлдириш
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\n[ID] [Summa]:").then(() => {
            bot.once('message', (m) => {
                const [idx, am] = m.text.split(" ");
                const goal = u.goals[parseInt(idx)-1];
                if (goal && !isNaN(am)) {
                    goal.collected += Number(am); saveDB();
                    bot.sendMessage(id, `✅ Пул қўшилди!`, getMenu(id));
                    bot.sendMessage(MY_ID, `💰 LOG: ${u.name} +${am} (${goal.title})`);
                }
            });
        });
    }

    if (text === L.btns[2]) { // Пульни ечиш
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title} (${g.collected})\n`);
        bot.sendMessage(id, list + "\n[ID] [Summa] (ечиш учун):").then(() => {
            bot.once('message', (m) => {
                const [idx, am] = m.text.split(" ");
                const goal = u.goals[parseInt(idx)-1];
                if (goal && goal.collected >= Number(am)) {
                    goal.collected -= Number(am); saveDB();
                    bot.sendMessage(id, `➖ Пуль ечилди.`, getMenu(id));
                    bot.sendMessage(MY_ID, `💸 LOG: ${u.name} ечди: -${am} (${goal.title})`);
                } else { bot.sendMessage(id, "❌ Маблағ етарли эмас!"); }
            });
        });
    }

    if (text === L.btns[3]) { // Янги мақсад
        bot.sendMessage(id, "Название цели:").then(() => {
            bot.once('message', (m1) => {
                bot.sendMessage(id, "Сумма:").then(() => {
                    bot.once('message', (m2) => {
                        u.goals.push({ title: m1.text, goal: Number(m2.text), collected: 0 });
                        saveDB(); bot.sendMessage(id, "🎯 Цель создана!", getMenu(id));
                    });
                });
            });
        });
    }

    if (text === L.btns[5]) { // Курслар
        const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
        const usd = res.data.find(x => x.Ccy === 'USD').Rate;
        bot.sendMessage(id, `🇺🇸 1 USD = ${usd} UZS`);
    }

    if (text === L.btns[7]) { // Блок
        u.locked = true; saveDB(); bot.sendMessage(id, L.locked, { reply_markup: { remove_keyboard: true } });
    }
});