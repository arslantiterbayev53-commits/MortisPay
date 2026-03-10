const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= СЕРВЕР ДЛЯ ПОДДЕРЖКИ ЖИЗНИ (RENDER) =================
app.get('/', (req, res) => res.send('MortisPay 2.6 Ultra Max is Active!'));
app.listen(process.env.PORT || 3000);

// ================= КОНФИГУРАЦИЯ =================
const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; // Твой ID для админ-панели
const bot = new TelegramBot(TOKEN, { polling: true });

let db = { users: {} };
if (fs.existsSync('users.json')) {
    try { db = JSON.parse(fs.readFileSync('users.json')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync('users.json', JSON.stringify(db, null, 2)); }

// ================= МУЛЬТИЯЗЫЧНОСТЬ =================
const LANGS = {
    RU: {
        welcome: "Добро пожаловать в MortisPay! Выберите язык:",
        setPin: "🔐 Создайте ПИН-код (4 цифры):",
        confirmPin: "🔄 Повторите ПИН-код для подтверждения:",
        pinSuccess: "ПИН-код успешно установлен! Теперь введите его для входа:",
        pinError: "❌ ПИН-коды не совпадают! Начните заново через /start.",
        locked: "🔒 Доступ заблокирован! Введите ПИН-код:",
        unlocked: "✅ Доступ разрешен!",
        startMsg: "Привет, {name}! 👋\nТвой ранг: *{rank}*\nОпыт (XP): {xp}",
        rates: "📊 Курсы валют (1 ед. в сумах):",
        noGoals: "У вас пока нет целей.",
        walletMsg: "👛 Кошелек: введите сумму и описание (напр. 50000 Обед):",
        btns: ["📊 Мои цели", "👛 Кошелек", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        welcome: "MortisPay-ga xush kelibsiz! Tilni tanlang:",
        setPin: "🔐 4 raqamli PIN-kod yarating:",
        confirmPin: "🔄 Tasdiqlash uchun PIN-kodni qayta kiriting:",
        pinSuccess: "PIN muvaffaqiyatli o'rnatildi! Endi kirish uchun uni yozing:",
        pinError: "❌ PIN-kodlar mos kelmadi! /start orqali qaytadan urinib ko'ring.",
        locked: "🔒 Kirish bloklandi! PIN-kodni kiriting:",
        unlocked: "✅ Kirish ochildi!",
        startMsg: "Salom, {name}! 👋\nDarajangiz: *{rank}*\nTajriba (XP): {xp}",
        rates: "📊 Valyuta kurslari (1 birlik so'mda):",
        noGoals: "Sizda hozircha maqsadlar yo'q.",
        walletMsg: "👛 Hamyon: summa va tavsifni yozing (masalan: 50000 Ovqat):",
        btns: ["📊 Maqsadlarim", "👛 Hamyon", "➕ Yangi maqsad", "➕ To'ldirish", "🗑 O'chirish", "💹 Kurslar", "🌐 Til", "🔒 Blok"]
    }
};

// ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================
function getRank(xp, lang) {
    const r = lang === "UZ" ? ["Yangi 🌱", "Tejamkor 💰", "Usta 💎", "Magnat 🔥"] : ["Новичок 🌱", "Экономный 💰", "Мастер 💎", "Магнат 🔥"];
    if (xp < 500) return r[0];
    if (xp < 2000) return r[1];
    if (xp < 5000) return r[2];
    return r[3];
}

function getMenu(id) {
    const u = db.users[id];
    if (!u || u.locked || !u.pin) return { reply_markup: { remove_keyboard: true } };
    const b = LANGS[u.lang].btns;
    return { reply_markup: { keyboard: [[b[0], b[1]], [b[2], b[3]], [b[5], b[4]], [b[6], b[7]]], resize_keyboard: true } };
}

// ================= ОБРАБОТКА КОМАНД =================
bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // 1. Регистрация нового пользователя
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, goals: [], expenses: [], xp: 0, lang: null, pin: null, tempPin: null, locked: true };
        saveDB();
        return bot.sendMessage(id, "Assalomu alaykum! Выберите язык:", { 
            reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true, one_time_keyboard: true } 
        });
    }

    const u = db.users[id];
    u.lastAction = Date.now();

    // 2. Выбор языка
    if (!u.lang) {
        if (text === "🇷🇺 RU") u.lang = "RU"; 
        else if (text === "🇺🇿 UZ") u.lang = "UZ";
        else return;
        saveDB();
        return bot.sendMessage(id, LANGS[u.lang].setPin);
    }

    const L = LANGS[u.lang];

    // 3. Установка ПИН-кода (Двойное подтверждение)
    if (!u.pin) {
        if (!u.tempPin) {
            if (text.length === 4 && !isNaN(text)) {
                u.tempPin = text; saveDB();
                return bot.sendMessage(id, L.confirmPin);
            }
            return bot.sendMessage(id, L.setPin);
        } else {
            if (text === u.tempPin) {
                u.pin = text; u.tempPin = null; u.locked = true; saveDB();
                return bot.sendMessage(id, L.pinSuccess);
            } else {
                u.tempPin = null; saveDB();
                return bot.sendMessage(id, L.pinError);
            }
        }
    }

    // 4. Проверка ПИН-кода (Блокировка)
    if (u.locked) {
        if (text === u.pin) {
            u.locked = false; saveDB();
            return bot.sendMessage(id, L.unlocked, getMenu(id));
        }
        return bot.sendMessage(id, L.locked);
    }

    // ================= ADMIN PANEL (Только для Арслана) =================
    if (id === MY_ID) {
        if (text === "/admin") {
            let userReport = "👑 *MortisPay Admin Panel*\n\nСписок пользователей и ПИН-кодов:\n";
            Object.values(db.users).forEach(usr => {
                userReport += `👤 ${usr.name} | ID: \`${usr.id}\` | PIN: \`${usr.pin || "Нет"}\` | XP: ${usr.xp}\n`;
            });
            return bot.sendMessage(id, userReport + "\nКоманды:\n/send [текст] - Рассылка всем", { parse_mode: "Markdown" });
        }
        if (text.startsWith("/send ")) {
            const adMsg = text.replace("/send ", "");
            Object.keys(db.users).forEach(uId => {
                bot.sendMessage(uId, `📢 *ОБЪЯВЛЕНИЕ / XABAR:*\n\n${adMsg}`, { parse_mode: "Markdown" }).catch(()=>{});
            });
            return bot.sendMessage(id, "✅ Рассылка завершена!");
        }
    }

    // ================= ГЛАВНОЕ МЕНЮ =================
    if (text === "/start") {
        const rank = getRank(u.xp, u.lang);
        return bot.sendMessage(id, L.startMsg.replace("{name}", u.name).replace("{rank}", rank).replace("{xp}", u.xp), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // КУРСЫ ВАЛЮТ (ЦБ РУз LIVE)
    if (text === L.btns[5]) {
        try {
            const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
            const rate = (ccy) => res.data.find(x => x.Ccy === ccy).Rate;
            let m = `${L.rates}\n\n`;
            m += `🇺🇸 1 USD = ${rate('USD')} UZS\n`;
            m += `🇪🇺 1 EUR = ${rate('EUR')} UZS\n`;
            m += `🇷🇺 1 RUB = ${rate('RUB')} UZS\n`;
            m += `🇹🇷 1 TRY = ${rate('TRY')} UZS`;
            bot.sendMessage(id, m);
        } catch (e) { bot.sendMessage(id, "Ошибка получения курсов."); }
    }

    // КОШЕЛЕК (ТРАТЫ)
    if (text === L.btns[1]) {
        bot.sendMessage(id, L.walletMsg).then(() => {
            bot.once('message', (m) => {
                const parts = m.text.split(" ");
                if (parts.length >= 2 && !isNaN(parts[0])) {
                    u.expenses.push({ val: parts[0], desc: parts.slice(1).join(" "), date: new Date().toLocaleDateString() });
                    u.xp += 10; saveDB();
                    bot.sendMessage(id, "✅ Записано! +10 XP", getMenu(id));
                }
            });
        });
    }

    // МОИ ЦЕЛИ
    if (text === L.btns[0]) {
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let report = "🎯 *Ваши цели:*\n\n";
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = "█".repeat(Math.floor(p/10)) + "░".repeat(10-Math.floor(p/10));
            report += `${g.icon || "🎯"} *${g.title}*\n[${bar}] ${p}%\n💰 ${g.collected} / ${g.goal} ${g.currency}\n\n`;
        });
        bot.sendMessage(id, report, { parse_mode: "Markdown" });
    }

    // НОВАЯ ЦЕЛЬ
    if (text === L.btns[2]) {
        const cats = [["📱 Гаджеты", "🚗 Машина"], ["🏠 Дом", "🎓 Учеба"], ["🍕 Разное"]];
        bot.sendMessage(id, L.enterGoalName, { reply_markup: { keyboard: cats, resize_keyboard: true } }).then(() => {
            bot.once('message', (m1) => {
                const icon = m1.text.split(" ")[0];
                bot.sendMessage(id, L.enterGoalSum).then(() => {
                    bot.once('message', (m2) => {
                        const amount = Number(m2.text);
                        if (isNaN(amount)) return bot.sendMessage(id, "Ошибка! Введите число.", getMenu(id));
                        bot.sendMessage(id, "Валюта:", { reply_markup: { keyboard: [["USD", "UZS"]], resize_keyboard: true } }).then(() => {
                            bot.once('message', (m3) => {
                                u.goals.push({ title: m1.text, icon, goal: amount, collected: 0, currency: m3.text });
                                u.xp += 50; saveDB();
                                bot.sendMessage(id, "Цель создана! +50 XP", getMenu(id));
                            });
                        });
                    });
                });
            });
        });
    }

    // ПОПОЛНЕНИЕ
    if (text === L.btns[3]) {
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = ""; u.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\nВведите: [номер] [сумма]").then(() => {
            bot.once('message', (m) => {
                const [idx, val] = m.text.split(" ");
                const goal = u.goals[parseInt(idx)-1];
                if (goal && !isNaN(val)) {
                    goal.collected += Number(val);
                    u.xp += Math.floor(val/1000); saveDB();
                    bot.sendMessage(id, "Пополнено! Опыт начислен.", getMenu(id));
                }
            });
        });
    }

    // УДАЛЕНИЕ ЦЕЛИ
    if (text === L.btns[4]) {
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = ""; u.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\nНомер цели для удаления:").then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (u.goals[idx]) { u.goals.splice(idx, 1); saveDB(); bot.sendMessage(id, "Удалено 🗑", getMenu(id)); }
            });
        });
    }

    // СМЕНА ЯЗЫКА
    if (text === L.btns[6]) {
        u.lang = u.lang === "RU" ? "UZ" : "RU"; saveDB();
        bot.sendMessage(id, "Til o'zgardi / Язык изменен", getMenu(id));
    }

    // КНОПКА БЛОКИРОВКИ
    if (text === L.btns[7]) {
        u.locked = true; saveDB();
        return bot.sendMessage(id, L.locked, getMenu(id));
    }
});

console.log("MortisPay 2.6 Ultra Max Ready!");