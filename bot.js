const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= СЕРВЕР ДЛЯ RENDER (АНТИ-СОН) =================
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('MortisPay is Running!'));
app.listen(port, () => console.log(`Server on port ${port}`));

// ================= НАСТРОЙКИ =================
const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; 
const bot = new TelegramBot(TOKEN, { polling: true });

let db = { users: {} };
if (fs.existsSync('users.json')) {
    try {
        db = JSON.parse(fs.readFileSync('users.json'));
    } catch (e) {
        db = { users: {} };
    }
}

function saveDB() {
    fs.writeFileSync('users.json', JSON.stringify(db, null, 2));
}

// ================= ЯЗЫКИ =================
const LANGS = {
    RU: {
        start: "Привет, {name}! 👋 Введите ваш ПИН-код для входа:",
        setPin: "Создайте 4-значный ПИН-код для защиты:",
        wrongPin: "Неверный ПИН! Попробуйте снова:",
        noGoals: "У вас нет целей.",
        goalsList: "🎯 Ваши цели:\n\n",
        enterGoalName: "Выберите категорию или введите название:",
        enterGoalSum: "Сумма цели:",
        selectCur: "Выберите валюту:",
        goalCreated: "Цель создана! ✅",
        errorNumber: "Ошибка! Введите число.",
        goalAdded: "Пополнено! ✅",
        goalDeleted: "Удалено! 🗑",
        remains: "Осталось накопить: ",
        rates: "📊 Курсы валют (ЦБ УЗ):",
        remind: "Не забудьте пополнить свои цели! 🎯",
        btns: ["📊 Мои цели", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить", "🌐 Язык", "💹 Курс валют"]
    },
    UZ: {
        start: "Salom, {name}! 👋 Kirish uchun PIN-kodni kiriting:",
        setPin: "Himoya uchun 4 xonali PIN yarating:",
        wrongPin: "Xato PIN! Qayta urinib ko'ring:",
        noGoals: "Maqsadlar yo'q.",
        goalsList: "🎯 Maqsadlar:\n\n",
        enterGoalName: "Kategoriya tanlang yoki nomini yozing:",
        enterGoalSum: "Summani kiriting:",
        selectCur: "Valyutani tanlang:",
        goalCreated: "Yaratildi! ✅",
        errorNumber: "Xato! Raqam kiriting.",
        goalAdded: "To'ldirildi! ✅",
        goalDeleted: "O'chirildi! 🗑",
        remains: "Yana yig'ish kerak: ",
        rates: "📊 Valyuta kurslari (O'zR MB):",
        remind: "Maqsadlaringizni to'ldirish esingizdan chiqmadimi? 🎯",
        btns: ["📊 Maqsadlarim", "➕ Yangi maqsad", "➕ To'ldirish", "🗑 O'chirish", "🌐 Til", "💹 Kurslar"]
    }
};

// ================= ФУНКЦИИ ГРАФИКИ =================
function getProgressBar(percent) {
    const filled = Math.min(10, Math.floor(percent / 10));
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
}

function getMenu(id) {
    const lang = db.users[id].lang || "RU";
    const b = LANGS[lang].btns;
    return { reply_markup: { keyboard: [[b[0], b[5]], [b[1], b[2]], [b[3], b[4]]], resize_keyboard: true } };
}

// ================= ОБРАБОТКА СООБЩЕНИЙ =================
bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    if (!db.users[id]) {
        db.users[id] = { 
            id, name: msg.from.first_name, username: msg.from.username || "n/a", 
            goals: [], lang: "RU", pin: null, locked: true, lastAction: Date.now() 
        };
        saveDB();
        return bot.sendMessage(id, LANGS.RU.setPin);
    }

    const user = db.users[id];
    user.lastAction = Date.now(); // Обновляем время активности
    const L = LANGS[user.lang] || LANGS.RU;

    // Регистрация ПИН-кода
    if (!user.pin) {
        if (text.length === 4 && !isNaN(text)) {
            user.pin = text;
            user.locked = false;
            saveDB();
            return bot.sendMessage(id, "ПИН-код установлен! ✅", getMenu(id));
        }
        return bot.sendMessage(id, L.setPin);
    }

    // Проверка ПИН-кода при входе
    if (user.locked) {
        if (text === user.pin) {
            user.locked = false;
            return bot.sendMessage(id, L.start.replace("{name}", user.name), getMenu(id));
        }
        return bot.sendMessage(id, L.wrongPin);
    }

    if (text === "/start") {
        return bot.sendMessage(id, L.start.replace("{name}", user.name), getMenu(id));
    }

    // КУРС ВАЛЮТ
    if (text === L.btns[5]) {
        try {
            const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
            const usd = res.data.find(c => c.Ccy === 'USD').Rate;
            const rub = res.data.find(c => c.Ccy === 'RUB').Rate;
            bot.sendMessage(id, `${L.rates}\n\n🇺🇸 1 USD = ${usd} UZS\n🇷🇺 1 RUB = ${rub} UZS`);
        } catch (e) {
            bot.sendMessage(id, "Ошибка получения курса.");
        }
    }

    // СПИСОК ЦЕЛЕЙ С ПРОГРЕСС-БАРОМ
    else if (text === L.btns[0]) {
        if (!user.goals.length) return bot.sendMessage(id, L.noGoals);
        let res = L.goalsList;
        user.goals.forEach((g, i) => {
            const percent = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = getProgressBar(percent);
            res += `${i + 1}. *${g.title}*\n`;
            res += `📊 [${bar}] ${percent}%\n`;
            res += `💰 ${g.collected} / ${g.goal} ${g.currency}\n\n`;
        });
        bot.sendMessage(id, res, { parse_mode: "Markdown" });
    }

    // НОВАЯ ЦЕЛЬ (С КАТЕГОРИЯМИ)
    else if (text === L.btns[1]) {
        const cats = [["📱 Гаджеты", "🚗 Авто"], ["🏠 Дом", "🎓 Учеба"], ["🍕 Разное"]];
        bot.sendMessage(id, L.enterGoalName, { reply_markup: { keyboard: cats, one_time_keyboard: true, resize_keyboard: true } }).then(() => {
            bot.once('message', (m1) => {
                const title = m1.text;
                bot.sendMessage(id, L.enterGoalSum).then(() => {
                    bot.once('message', (m2) => {
                        const sum = Number(m2.text);
                        if (isNaN(sum)) return bot.sendMessage(id, L.errorNumber);
                        bot.sendMessage(id, L.selectCur, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], one_time_keyboard: true, resize_keyboard: true } }).then(() => {
                            bot.once('message', (m3) => {
                                user.goals.push({ title, goal: sum, collected: 0, currency: m3.text, history: [] });
                                saveDB();
                                bot.sendMessage(id, L.goalCreated, getMenu(id));
                            });
                        });
                    });
                });
            });
        });
    }

    // ПОПОЛНЕНИЕ (С ИСТОРИЕЙ)
    else if (text === L.btns[2]) {
        if (!user.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = "№:\n"; user.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list).then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (user.goals[idx]) {
                    bot.sendMessage(id, L.enterGoalSum).then(() => {
                        bot.once('message', (m2) => {
                            const val = Number(m2.text);
                            if (!isNaN(val)) {
                                user.goals[idx].collected += val;
                                saveDB();
                                bot.sendMessage(id, L.goalAdded, getMenu(id));
                            }
                        });
                    });
                }
            });
        });
    }

    // УДАЛЕНИЕ
    else if (text === L.btns[3]) {
        if (!user.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = "Del №:\n"; user.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list).then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (user.goals[idx]) {
                    user.goals.splice(idx, 1);
                    saveDB();
                    bot.sendMessage(id, L.goalDeleted, getMenu(id));
                }
            });
        });
    }

    // СМЕНА ЯЗЫКА
    else if (text === L.btns[4]) {
        user.lang = user.lang === "RU" ? "UZ" : "RU";
        saveDB();
        bot.sendMessage(id, LANGS[user.lang].languageSet || "Done!", getMenu(id));
    }

    // АДМИНКА
    if (text === "/admin" && id === MY_ID) {
        bot.sendMessage(id, `📊 Юзеров: ${Object.keys(db.users).length}`);
    }
});

// ================= УДЕРЖАНИЕ ЮЗЕРА (10 ЧАСОВ) =================
setInterval(() => {
    const NOW = Date.now();
    const TEN_HOURS = 10 * 60 * 60 * 1000;
    Object.values(db.users).forEach(u => {
        if (u.lastAction && (NOW - u.lastAction) > TEN_HOURS) {
            const msg = LANGS[u.lang || "RU"].remind;
            bot.sendMessage(u.id, msg).catch(() => {});
            u.lastAction = NOW; // Не спамим
            saveDB();
        }
    });
}, 60 * 60 * 1000); // Проверка каждый час

console.log("MortisPay V2.0 Запущен!");