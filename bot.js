require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Для Render (чтобы не падал)
const app = express();
app.get('/', (req, res) => res.send('OK'));
app.listen(process.env.PORT || 3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const MY_ID = process.env.ADMIN_ID;

let db = JSON.parse(fs.readFileSync('users.json', 'utf8'));
const save = () => fs.writeFileSync('users.json', JSON.stringify(db, null, 2));

const LANGS = {
    RU: {
        start: "Привет, {name}!",
        remains: "Осталось: ",
        btns: ["📊 Мои цели", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить", "🌐 Язык"]
    },
    UZ: {
        start: "Salom, {name}!",
        remains: "Qoldi: ",
        btns: ["📊 Maqsadlarim", "➕ Yangi maqsad", "➕ To'ldirish", "🗑 O'chirish", "🌐 Til"]
    },
    EN: {
        start: "Hello, {name}!",
        remains: "Remaining: ",
        btns: ["📊 My Goals", "➕ New Goal", "➕ Top-up", "🗑 Delete", "🌐 Language"]
    }
};

const getMenu = (id) => {
    const b = LANGS[db.users[id].lang].btns;
    return { reply_markup: { keyboard: [[b[0]], [b[1], b[2]], [b[3], b[4]]], resize_keyboard: true } };
};

bot.on('message', (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    if (!db.users[id]) {
        db.users[id] = { name: msg.from.first_name, goals: [], lang: "RU" };
        save();
        bot.sendMessage(MY_ID, `🔔 Новый юзер: ${msg.from.first_name}`);
    }

    const L = LANGS[db.users[id].lang];

    if (text === "/start") return bot.sendMessage(id, L.start.replace("{name}", db.users[id].name), getMenu(id));

    if (text === "/admin" && id === MY_ID) {
        return bot.sendMessage(id, `Юзеров: ${Object.keys(db.users).length}\n/users - Список`);
    }

    if (text === L.btns[4]) { // Смена языка
        const keys = Object.keys(LANGS);
        db.users[id].lang = keys[(keys.indexOf(db.users[id].lang) + 1) % 3];
        save();
        return bot.sendMessage(id, "OK", getMenu(id));
    }

    if (text === L.btns[0]) { // Показать цели и %
        const goals = db.users[id].goals;
        if (!goals.length) return bot.sendMessage(id, "Пусто");
        let res = "";
        goals.forEach((g, i) => {
            const perc = Math.min(100, Math.floor((g.c / g.g) * 100));
            res += `${i + 1}. ${g.t}: ${g.c}/${g.g} ${g.cur} (${perc}%)\n${L.remains}${g.g - g.c}\n\n`;
        });
        bot.sendMessage(id, res);
    }

    // Логика создания цели (упрощенная)
    if (text === L.btns[1]) {
        bot.sendMessage(id, "Название:").then(() => {
            bot.once('message', (m1) => {
                bot.sendMessage(id, "Сумма:").then(() => {
                    bot.once('message', (m2) => {
                        bot.sendMessage(id, "Валюта (USD/UZS/RUB):").then(() => {
                            bot.once('message', (m3) => {
                                db.users[id].goals.push({ t: m1.text, g: Number(m2.text), c: 0, cur: m3.text });
                                save();
                                bot.sendMessage(id, "Готово", getMenu(id));
                            });
                        });
                    });
                });
            });
        });
    }
});

bot.onText(/\/users/, (msg) => {
    if (String(msg.from.id) === MY_ID) {
        let s = "Список:\n";
        Object.values(db.users).forEach(u => s += `- ${u.name}\n`);
        bot.sendMessage(MY_ID, s);
    }
});