const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// СЕРВЕР ДЛЯ ПОДДЕРЖКИ РАБОТЫ НА RENDER
app.get('/', (req, res) => res.send('MortisPay 2.7 Final is Online!'));
app.listen(process.env.PORT || 3000);

// КОНФИГУРАЦИЯ
const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; 
const bot = new TelegramBot(TOKEN, { polling: true });

let db = { users: {} };
if (fs.existsSync('users.json')) {
    try { db = JSON.parse(fs.readFileSync('users.json')); } catch (e) { db = { users: {} }; }
}
function saveDB() { fs.writeFileSync('users.json', JSON.stringify(db, null, 2)); }

// ТЕКСТЫ И ЛОКАЛИЗАЦИЯ
const LANGS = {
    RU: {
        selectLang: "Выберите язык / Tilni tanlang:",
        setPin: "🔐 Создайте ПИН-код (4 цифры):",
        confirmPin: "🔄 Повторите ПИН-код:",
        pinSuccess: "ПИН-код установлен! Введите его для входа:",
        pinError: "❌ Ошибка! ПИН-коды не совпали. Попробуйте снова через /start",
        locked: "🔒 Доступ заблокирован! Введите ПИН:",
        unlocked: "✅ Доступ открыт!",
        start: "Привет, {name}!\nТвой ранг: *{rank}*\nОпыт (XP): {xp}",
        rates: "📊 Курсы валют (ЦБ УЗ):",
        walletMsg: "👛 Кошелек: введите сумму и описание (напр. 50000 Обед):",
        noGoals: "У вас пока нет целей.",
        btns: ["📊 Мои цели", "👛 Кошелек", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить", "💹 Курсы", "🌐 Язык", "🔒 Блок"]
    },
    UZ: {
        selectLang: "Tilni tanlang / Выберите язык:",
        setPin: "🔐 PIN-kod yarating (4 raqam):",
        confirmPin: "🔄 PIN-kodni tasdiqlang:",
        pinSuccess: "PIN o'rnatildi! Kirish uchun uni yozing:",
        pinError: "❌ Xato! PIN-kodlar mos kelmadi. /start orqali qaytadan urinib ko'ring.",
        locked: "🔒 Kirish bloklandi! PIN kiriting:",
        unlocked: "✅ Kirish ochildi!",
        start: "Salom, {name}!\nDarajangiz: *{rank}*\nTajriba (XP): {xp}",
        rates: "📊 Valyuta kurslari (MB):",
        walletMsg: "👛 Hamyon: summa va tavsifni yozing (masalan: 50000 Ovqat):",
        noGoals: "Sizda maqsadlar yo'q.",
        btns: ["📊 Maqsadlar", "👛 Hamyon", "➕ Yangi", "➕ To'ldirish", "🗑 O'chirish", "💹 Kurslar", "🌐 Til", "🔒 Blok"]
    }
};

// РАНГИ
function getRank(id, xp, lang) {
    if (id === MY_ID) return "👑 OWNER / СОЗДАТЕЛЬ";
    const r = lang === "UZ" ? ["Silver ⚪", "Gold 🟡", "Platinum 💎", "Elite 🔥"] : ["Silver ⚪", "Gold 🟡", "Platinum 💎", "Elite 🔥"];
    if (xp < 1000) return r[0];
    if (xp < 5000) return r[1];
    if (xp < 15000) return r[2];
    return r[3];
}

function getMenu(id) {
    const u = db.users[id];
    if (!u || u.locked || !u.pin) return { reply_markup: { remove_keyboard: true } };
    const b = LANGS[u.lang].btns;
    return { reply_markup: { keyboard: [[b[0], b[1]], [b[2], b[3]], [b[5], b[4]], [b[6], b[7]]], resize_keyboard: true } };
}

bot.on('message', async (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    // 1. РЕГИСТРАЦИЯ
    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, goals: [], expenses: [], xp: 0, lang: null, pin: null, tempPin: null, locked: true };
        saveDB();
        return bot.sendMessage(id, LANGS.RU.selectLang, { reply_markup: { keyboard: [["🇺🇿 UZ", "🇷🇺 RU"]], resize_keyboard: true } });
    }

    const u = db.users[id];

    // 2. ВЫБОР ЯЗЫКА (ПЕРВЫМ ДЕЛОМ)
    if (!u.lang) {
        if (text === "🇺🇿 UZ") u.lang = "UZ";
        else if (text === "🇷🇺 RU") u.lang = "RU";
        else return;
        saveDB();
        return bot.sendMessage(id, LANGS[u.lang].setPin);
    }

    const L = LANGS[u.lang];

    // 3. ПИН-КОД (ДВОЙНАЯ ПРОВЕРКА)
    if (!u.pin) {
        if (!u.tempPin) {
            if (text.length === 4 && !isNaN(text)) {
                u.tempPin = text; saveDB(); return bot.sendMessage(id, L.confirmPin);
            }
            return bot.sendMessage(id, L.setPin);
        } else {
            if (text === u.tempPin) {
                u.pin = text; u.tempPin = null; u.locked = true; saveDB();
                return bot.sendMessage(id, L.pinSuccess);
            } else {
                u.tempPin = null; saveDB(); return bot.sendMessage(id, L.pinError);
            }
        }
    }

    // 4. БЛОКИРОВКА (ПИН НУЖЕН ВСЕГДА)
    if (u.locked) {
        if (text === u.pin) {
            u.locked = false; saveDB();
            return bot.sendMessage(id, L.unlocked, getMenu(id));
        }
        return bot.sendMessage(id, L.locked);
    }

    // --- ADMIN PANEL (ONLY FOR ARSLAN) ---
    if (id === MY_ID) {
        if (text === "/admin") {
            let s = "👑 *ADMIN DATABASE*\n\n";
            Object.values(db.users).forEach(usr => {
                const rank = getRank(usr.id, usr.xp, usr.lang || "RU");
                s += `👤 *${usr.name}*\nID: \`${usr.id}\` | PIN: \`${usr.pin}\`\nRank: ${rank} | XP: ${usr.xp}\n\n`;
            });
            return bot.sendMessage(id, s, { parse_mode: "Markdown" });
        }
        if (text === "/push_all") {
            Object.keys(db.users).forEach(uId => bot.sendMessage(uId, "💰 *Напоминание / Eslatma:* Не забудьте обновить свои цели и баланс!"));
            return bot.sendMessage(id, "✅ OK");
        }
    }

    // --- ФУНКЦИИ ГЛАВНОГО МЕНЮ ---
    if (text === "/start") {
        const r = getRank(id, u.xp, u.lang);
        return bot.sendMessage(id, L.start.replace("{name}", u.name).replace("{rank}", r).replace("{xp}", u.xp), { parse_mode: "Markdown", ...getMenu(id) });
    }

    if (text === L.btns[5]) { // Курсы
        const res = await axios.get('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
        const r = (c) => res.data.find(x => x.Ccy === c).Rate;
        let m = `${L.rates}\n\n🇺🇸 1 USD = ${r('USD')} UZS\n🇪🇺 1 EUR = ${r('EUR')} UZS\n🇷🇺 1 RUB = ${r('RUB')} UZS\n🇹🇷 1 TRY = ${r('TRY')} UZS`;
        bot.sendMessage(id, m);
    }

    if (text === L.btns[1]) { // Кошелек (Hamyon)
        let hist = u.lang === "RU" ? "Последние траты:\n" : "Oxirgi xarajatlar:\n";
        u.expenses.slice(-5).forEach(e => hist += `▪️ ${e.val} - ${e.desc}\n`);
        bot.sendMessage(id, hist + "\n" + L.walletMsg).then(() => {
            bot.once('message', (m) => {
                const p = m.text.split(" ");
                if (p.length >= 2 && !isNaN(p[0])) {
                    u.expenses.push({ val: p[0], desc: p.slice(1).join(" ") });
                    u.xp += 20; saveDB(); bot.sendMessage(id, "✅ +20 XP", getMenu(id));
                }
            });
        });
    }

    if (text === L.btns[0]) { // Мои цели
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let report = "🎯 *Goals:*\n\n";
        u.goals.forEach((g, i) => {
            const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            const bar = "█".repeat(Math.floor(p/10)) + "░".repeat(10-Math.floor(p/10));
            report += `${i+1}. *${g.title}*\n[${bar}] ${p}%\n💰 ${g.collected}/${g.goal} UZS\n\n`;
        });
        bot.sendMessage(id, report, { parse_mode: "Markdown" });
    }

    if (text === L.btns[2]) { // Новая цель
        bot.sendMessage(id, u.lang === "RU" ? "Название цели:" : "Maqsad nomi:").then(() => {
            bot.once('message', (m1) => {
                bot.sendMessage(id, u.lang === "RU" ? "Сумма:" : "Summa:").then(() => {
                    bot.once('message', (m2) => {
                        u.goals.push({ title: m1.text, goal: Number(m2.text), collected: 0 });
                        u.xp += 100; saveDB(); bot.sendMessage(id, "✅ +100 XP", getMenu(id));
                    });
                });
            });
        });
    }

    if (text === L.btns[3]) { // Пополнить
        if (!u.goals.length) return bot.sendMessage(id, L.noGoals);
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\n[номер] [сумма]:").then(() => {
            bot.once('message', (m) => {
                const [idx, val] = m.text.split(" ");
                const g = u.goals[parseInt(idx)-1];
                if (g && !isNaN(val)) {
                    g.collected += Number(val);
                    u.xp += Math.floor(val/1000);
                    if (g.collected >= g.goal) { u.xp += 500; bot.sendMessage(id, "🎉 GOAL 100%! +500 XP"); }
                    saveDB(); bot.sendMessage(id, "✅", getMenu(id));
                }
            });
        });
    }

    if (text === L.btns[4]) { // Удалить
        let list = ""; u.goals.forEach((g, i) => list += `${i+1}. ${g.title}\n`);
        bot.sendMessage(id, list + "\nID to delete:").then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text)-1;
                if (u.goals[idx]) { u.goals.splice(idx, 1); saveDB(); bot.sendMessage(id, "🗑", getMenu(id)); }
            });
        });
    }

    if (text === L.btns[7]) { u.locked = true; saveDB(); bot.sendMessage(id, L.locked, getMenu(id)); }
    if (text === L.btns[6]) { u.lang = u.lang === "RU" ? "UZ" : "RU"; saveDB(); bot.sendMessage(id, "OK", getMenu(id)); }
});