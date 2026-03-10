const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= СЕРВЕР ДЛЯ RENDER =================
app.get('/', (req, res) => res.send('MortisPay 2.5 Ultimate is Online!'));
app.listen(process.env.PORT || 3000);

// ================= НАСТРОЙКИ =================
const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; 
const bot = new TelegramBot(TOKEN, { polling: true });

let db = { users: {} };
if (fs.existsSync('users.json')) {
    try { db = JSON.parse(fs.readFileSync('users.json')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync('users.json', JSON.stringify(db, null, 2)); }

// ================= ТЕКСТЫ И ЯЗЫКИ =================
const LANGS = {
    RU: {
        setPin: "Придумайте ПИН-код из 4 цифр:",
        locked: "Доступ заблокирован! 🔒 Введите ПИН:",
        wrongPin: "Неверно! Попробуйте еще раз:",
        unlocked: "Доступ открыт! ✅",
        start: "С возвращением, {name}! 👋\nВаш ранг: *{rank}*\nОпыт (XP): {xp}",
        noGoals: "У вас нет активных целей.",
        goalsList: "🎯 Ваши цели:\n\n",
        enterGoalName: "Выберите категорию или введите название:",
        enterGoalSum: "Какая сумма цели?",
        selectCur: "Выберите валюту:",
        goalCreated: "Цель создана! ✅",
        errorNumber: "Ошибка! Нужно число.",
        rates: "📊 Курсы валют (ЦБ УЗ):",
        wallet: "👛 Кошелек (Траты):",
        expenseAdded: "Трата записана! 📉 (+10 XP)",
        goalAdded: "Пополнение принято! 💰 (+{xp} XP)",
        ranks: ["Новичок 🌱", "Экономный 💰", "Мастер 💎", "Магнат 🔥"],
        btns: ["📊 Мои цели", "👛 Кошелек", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        setPin: "4 raqamli PIN-kod yarating:",
        locked: "Kirish bloklandi! 🔒 PIN kiriting:",
        wrongPin: "Xato! Qayta urinib ko'ring:",
        unlocked: "Kirish ochildi! ✅",
        start: "Xush kelibsiz, {name}! 👋\nDarajangiz: *{rank}*\nTajriba (XP): {xp}",
        noGoals: "Maqsadlar hali yo'q.",
        goalsList: "🎯 Maqsadlaringiz:\n\n",
        enterGoalName: "Kategoriya tanlang yoki nomini yozing:",
        enterGoalSum: "Maqsad summasi qancha?",
        selectCur: "Valyutani tanlang:",
        goalCreated: "Maqsad yaratildi! ✅",
        errorNumber: "Xato! Raqam kiriting.",
        rates: "📊 Valyuta kurslari (MB):",
        wallet: "👛 Hamyon (Xarajatlar):",
        expenseAdded: "Xarajat yozildi! 📉 (+10 XP)",
        goalAdded: "To'ldirildi! 💰 (+{xp} XP)",
        ranks: ["Yangi 🟢", "Tejamkor 🟡", "Usta 🟠", "Magnat 🔴"],
        btns: ["📊 Maqsadlarim", "👛 Hamyon", "➕ Yangi", "➕ To'ldirish", "🗑 O'chirish", "💹 Kurslar", "🌐 Til", "🔒 Blok"]
    }
};

// ================= ФУНКЦИИ ГРАФИКИ И РАНГОВ =================
function getRank(xp, lang) {
    const r = LANGS[lang].ranks;
    if (xp < 500) return r[0];
    if (xp < 2000) return r[1];
    if (xp < 5000) return r[2];
    return r[3];
}

function getMenu(id) {
    const u = db.users[id];
    if (u.locked) return { reply_markup: { remove_keyboard: true } };
    const L = LANGS[u.lang || "RU"];
    const b = L.btns;
    return { reply_markup: { keyboard: [[b[0], b[1]], [b[2], b[3]], [b[4], b[5]], [b[6], b[7]]], resize_keyboard: true } };
}

// ================= ОБРАБОТКА СООБЩЕНИЙ =================
bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // 1. ИНИЦИАЛИЗАЦИЯ И ВЫБОР ЯЗЫКА
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, goals: [], expenses: [], xp: 0, lang: null, pin: null, locked: false, lastAction: Date.now() };
        saveDB();
        return bot.sendMessage(id, "Assalomu alaykum! Выберите язык:", { 
            reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true, one_time_keyboard: true } 
        });
    }

    const u = db.users[id];
    u.lastAction = Date.now();

    if (!u.lang) {
        if (text === "🇷🇺 RU") u.lang = "RU";
        else if (text === "🇺🇿 UZ") u.lang = "UZ";
        else return;
        saveDB();
        return bot.sendMessage(id, LANGS[u.lang].setPin);
    }

    const L = LANGS[u.lang];

    // 2. УСТАНОВКА И ПРОВЕРКА ПИН
    if (!u.pin) {
        if (text.length === 4 && !isNaN(text)) {
            u.pin = text; saveDB();
            return bot.sendMessage(id, L.unlocked, getMenu(id));
        }
        return bot.sendMessage(id, L.setPin);
    }

    if (u.locked) {
        if (text === u.pin) {
            u.locked = false; saveDB();
            return bot.sendMessage(id, L.unlocked, getMenu(id));
        }
        return bot.sendMessage(id, L.locked);
    }

    // --- АДМИН ПАНЕЛЬ ---
    if (text === "/admin" && id === MY_ID) {
        return bot.sendMessage(id, `📊 Юзеров: ${Object.keys(db.users).length}\nРассылка: /send [текст]`);
    }
    if (text.startsWith("/send ") && id === MY_ID) {
        const ad = text.replace("/send ", "");
        Object.keys(db.users).forEach(uId => bot.sendMessage(uId, `📢 *ОБЪЯВЛЕНИЕ:*\n\n${ad}`, { parse_mode: "Markdown" }).catch(()=>{}));
        return bot.sendMessage(id, "✅ Отправлено");
    }

    // --- ГЛАВНОЕ МЕНЮ ---
    if (text === "/start") {
        const r = getRank(u.xp, u.lang);
        return bot.sendMessage(id, L.start.replace("{name}", u.name).replace("{rank}", r).replace("{xp}", u.xp), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // КНОПКА БЛОКИРОВКИ
    if (text === L.btns[7]) {
        u.locked = true; saveDB();
        return bot.sendMessage(id, L.locked, getMenu(id));
    }

    // КУРСЫ ВАЛЮТ (LIVE)
    if (text === L.btns[5]) {
        try {
            const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
            const gV = (c) => res.data.find(x => x.Ccy === c).Rate;
            let m = `${L.rates}\n\n🇺🇸 USD: ${gV('USD')}\n🇪🇺 EUR: ${gV('EUR')}\n🇷🇺 RUB: ${gV('RUB')}\n🇰🇿 KZT: ${gV('KZT')}\n🇹🇷 TRY: ${gV('TRY')}`;
            bot.sendMessage(id, m);
        } catch (e) { bot.sendMessage(id, "API Error"); }
    }

    // КОШЕЛЕК (ТРАТЫ)
    else if (text === L.btns[1]) {
        bot.sendMessage(id, "Введите сумму и описание через пробел\n(Например: 20000 Обед):").then(() => {
            bot.once('message', (m) => {
                const parts = m.text.split(" ");
                if (parts.length >= 2 && !isNaN(parts[0])) {
                    u.expenses.push({ val: parts[0], desc: parts.slice(1).join(" "), date: new Date().toLocaleDateString() });
                    u.xp += 10; saveDB();
                    bot.sendMessage(id, L.expenseAdded, getMenu(id));
                }
            });
        });
    }

    // МОИ ЦЕЛИ (ПРОГРЕСС И ИКОНКИ)
    else if (text === L.btns[0]) {
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let res = L.goalsList;
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = "█".repeat(Math.floor(p/10)) + "░".repeat(10-Math.floor(p/10));
            res += `${g.icon || "🎯"} *${g.title}*\n📊 [${bar}] ${p}%\n💰 ${g.collected} / ${g.goal} ${g.currency}\n\n`;
        });
        bot.sendMessage(id, res, { parse_mode: "Markdown" });
    }

    // НОВАЯ ЦЕЛЬ
    else if (text === L.btns[2]) {
        const cats = [["📱 Гаджеты", "🚗 Авто"], ["🏠 Дом", "🎓 Учеба"], ["🍕 Разное"]];
        bot.sendMessage(id, L.enterGoalName, { reply_markup: { keyboard: cats, resize_keyboard: true } }).then(() => {
            bot.once('message', (m1) => {
                const icon = m1.text.split(" ")[0];
                bot.sendMessage(id, L.enterGoalSum).then(() => {
                    bot.once('message', (m2) => {
                        const sum = Number(m2.text);
                        if (isNaN(sum)) return bot.sendMessage(id, L.errorNumber, getMenu(id));
                        bot.sendMessage(id, L.selectCur, { reply_markup: { keyboard: [["USD", "UZS", "RUB"]], resize_keyboard: true } }).then(() => {
                            bot.once('message', (m3) => {
                                u.goals.push({ title: m1.text, icon, goal: sum, collected: 0, currency: m3.text });
                                u.xp += 50; saveDB();
                                bot.sendMessage(id, L.goalCreated, getMenu(id));
                            });
                        });
                    });
                });
            });
        });
    }

    // ПОПОЛНЕНИЕ (+XP)
    else if (text === L.btns[3]) {
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = "№ | Цель:\n"; u.goals.forEach((g, i) => list += `${i + 1} | ${g.title}\n`);
        bot.sendMessage(id, list + "\nВведите: [номер] [сумма]\n(Например: 1 50000)").then(() => {
            bot.once('message', (m) => {
                const [idx, val] = m.text.split(" ");
                const goal = u.goals[parseInt(idx)-1];
                if (goal && !isNaN(val)) {
                    goal.collected += Number(val);
                    const addXp = Math.floor(val/1000);
                    u.xp += addXp; saveDB();
                    bot.sendMessage(id, L.goalAdded.replace("{xp}", addXp), getMenu(id));
                }
            });
        });
    }

    // СМЕНА ЯЗЫКА
    else if (text === L.btns[6]) {
        u.lang = u.lang === "RU" ? "UZ" : "RU"; saveDB();
        bot.sendMessage(id, "OK", getMenu(id));
    }

    // УДАЛЕНИЕ
    else if (text === L.btns[4]) {
        let list = "№:\n"; u.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list).then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (u.goals[idx]) { u.goals.splice(idx, 1); saveDB(); bot.sendMessage(id, "🗑", getMenu(id)); }
            });
        });
    }
});

// АВТО-БЛОКИРОВКА (10 ЧАСОВ)
setInterval(() => {
    const NOW = Date.now();
    Object.values(db.users).forEach(u => {
        if (u.lastAction && (NOW - u.lastAction) > 10 * 3600000) {
            u.locked = true; saveDB();
            const msg = u.lang === "UZ" ? "Xavfsizlik: PIN kiriting! 🔒" : "Безопасность: введите ПИН! 🔒";
            bot.sendMessage(u.id, msg, { reply_markup: { remove_keyboard: true } }).catch(() => {});
            u.lastAction = NOW; 
        }
    });
}, 3600000);

console.log("MortisPay 2.5 Ultimate Final Запущен!");