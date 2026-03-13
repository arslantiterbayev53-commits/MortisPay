const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const express = require("express");

// ==========================================
// ⚙️ CONFIG & DATABASE
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = 6736116111; // Arslan
const DB_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.get("/", (req, res) => res.send("MortisPay Engine v5: Active"));
app.listen(process.env.PORT || 3000);

let db = { users: {}, system: { totalUsers: 0, globalVolume: 0 } };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ==========================================
// 🌍 LOCALIZATION (RU, UZ, EN)
// ==========================================
const STRINGS = {
    ru: {
        w: "🏦 **MORTISPAY**\nПривет, Арслан. Твой капитал в безопасности.",
        m_my: "💰 Мои цели", m_add: "✨ Создать", m_out: "💸 Снять деньги",
        m_top: "📥 Пополнить", m_plan: "📉 Финплан", m_lang: "🌐 Язык",
        m_adm: "💎 Админ", ent_n: "🏷 Название цели:", ent_s: "💵 Сумма цели:",
        ent_v: "💎 Валюта:", ent_idx: "🔢 Введите номер цели:", 
        ent_a: "💳 Сумма:", no_g: "❌ Нет целей.", done: "✅ Готово!",
        err: "⚠️ Ошибка в вводе.", low: "⚠️ Недостаточно средств на цели!",
        daily: "🗓 В день нужно: **{val} {cur}**",
        prediction: "🔮 С твоим темпом накопишь к: **{date}**"
    },
    uz: {
        w: "🏦 **MORTISPAY**\nXush kelibsiz, Arslan. Mablag'ingiz xavfsiz.",
        m_my: "💰 Maqsadlarim", m_add: "✨ Yaratish", m_out: "💸 Pulni yechish",
        m_top: "📥 To'ldirish", m_plan: "📉 Reja", m_lang: "🌐 Til",
        m_adm: "💎 Admin", ent_n: "🏷 Maqsad nomi:", ent_s: "💵 Maqsad summasi:",
        ent_v: "💎 Valyuta:", ent_idx: "🔢 Maqsad raqamini kiriting:",
        ent_a: "💳 Summa:", no_g: "❌ Maqsadlar yo'q.", done: "✅ Tayyor!",
        err: "⚠️ Xato kiritildi.", low: "⚠️ Maqsadda mablag' yetarli emas!",
        daily: "🗓 Kuniga: **{val} {cur}**",
        prediction: "🔮 Taxminiy sana: **{date}**"
    },
    en: {
        w: "🏦 **MORTISPAY**\nWelcome, Arslan. Your vault is active.",
        m_my: "💰 My Goals", m_add: "✨ Create", m_out: "💸 Withdraw",
        m_top: "📥 Deposit", m_plan: "📉 Plan", m_lang: "🌐 Language",
        m_adm: "💎 Admin", ent_n: "🏷 Goal name:", ent_s: "💵 Target sum:",
        ent_v: "💎 Currency:", ent_idx: "🔢 Enter goal number:",
        ent_a: "💳 Amount:", no_g: "❌ No goals found.", done: "✅ Done!",
        err: "⚠️ Input error.", low: "⚠️ Not enough funds in goal!",
        daily: "🗓 Daily need: **{val} {cur}**",
        prediction: "🔮 Estimated date: **{date}**"
    }
};

// ==========================================
// 🛠 HELPERS
// ==========================================
const getMenu = (lang) => {
    const s = STRINGS[lang];
    return {
        reply_markup: {
            keyboard: [
                [s.m_my, s.m_add], [s.m_top, s.m_out],
                [s.m_plan, s.m_lang], [s.m_adm]
            ], resize_keyboard: true
        }
    };
};

const getBar = (p) => "🟩".repeat(Math.min(10, Math.floor(p/10))) + "⬜".repeat(10 - Math.min(10, Math.floor(p/10)));

// ==========================================
// 🚀 ENGINE
// ==========================================
bot.on("message", async (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text) return;

    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, lang: "ru", goals: [], state: "IDLE", xp: 0 };
        db.system.totalUsers++;
        save();
        bot.sendMessage(MY_ID, `🆕 New User: ${msg.from.first_name} (ID: ${id})`);
    }

    const u = db.users[id];
    const s = STRINGS[u.lang];

    if (text === "/start" || text === "🔙 Back" || text === "🔙 Назад") {
        u.state = "IDLE"; save();
        return bot.sendMessage(id, s.w, { parse_mode: "Markdown", ...getMenu(u.lang) });
    }

    // --- ЛОГИКА АДМИНА ---
    if (text === s.m_adm && id === MY_ID) {
        return bot.sendMessage(id, `💎 **ADMIN PANEL**\n\nUsers: ${db.system.totalUsers}\nVolume: ${db.system.globalVolume} UZS`, {
            reply_markup: { inline_keyboard: [[{ text: "📢 Broadcast", callback_data: "adm_bc" }]] }
        });
    }

    if (u.state === "IDLE") {
        switch (text) {
            case s.m_lang:
                u.state = "SET_LANG";
                return bot.sendMessage(id, "🌐 Выбери язык / Tilni tanlang / Select Language:", {
                    reply_markup: { keyboard: [["🇷🇺 RU", "🇺🇿 UZ", "🇺🇸 EN"]], resize_keyboard: true }
                });

            case s.m_my:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                let list = "";
                u.goals.forEach((g, i) => {
                    const p = Math.min(100, Math.floor((g.collected / g.goal) * 100));
                    list += `${i+1}. **${g.title}**\n${getBar(p)} ${p}%\n💰 ${g.collected}/${g.goal} ${g.currency}\n\n`;
                });
                return bot.sendMessage(id, list, { parse_mode: "Markdown" });

            case s.m_add: u.state = "A_N"; return bot.sendMessage(id, s.ent_n);
            case s.m_top: u.state = "T_IDX"; return bot.sendMessage(id, s.ent_idx);
            case s.m_out: u.state = "O_IDX"; return bot.sendMessage(id, s.ent_idx);
            case s.m_plan:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                let plan = "📉 **Financial Plan:**\n\n";
                u.goals.forEach(g => {
                    const left = Math.max(0, g.goal - g.collected);
                    const daily = (left / 30).toFixed(0);
                    plan += `🎯 *${g.title}*\n` + s.daily.replace("{val}", daily).replace("{cur}", g.currency) + "\n\n";
                });
                return bot.sendMessage(id, plan, { parse_mode: "Markdown" });
        }
    }

    // --- FSM: СОСТОЯНИЯ (СОЗДАНИЕ, ПОПОЛНЕНИЕ, СНЯТИЕ) ---
    if (u.state === "SET_LANG") {
        if (text.includes("RU")) u.lang = "ru";
        if (text.includes("UZ")) u.lang = "uz";
        if (text.includes("EN")) u.lang = "en";
        u.state = "IDLE"; save();
        return bot.sendMessage(id, STRINGS[u.lang].done, getMenu(u.lang));
    }

    // Создание
    if (u.state === "A_N") { u.tmp = { title: text }; u.state = "A_S"; return bot.sendMessage(id, s.ent_s); }
    if (u.state === "A_S") {
        const val = parseFloat(text.replace(",", "."));
        if (isNaN(val)) return bot.sendMessage(id, s.err);
        u.tmp.goal = val; u.state = "A_V";
        return bot.sendMessage(id, s.ent_v, { reply_markup: { keyboard: [["UZS", "USD", "RUB"]], resize_keyboard: true } });
    }
    if (u.state === "A_V") {
        u.tmp.currency = text; u.tmp.collected = 0; u.tmp.history = [];
        u.goals.push(u.tmp); u.state = "IDLE"; save();
        return bot.sendMessage(id, s.done, getMenu(u.lang));
    }

    // Пополнение
    if (u.state === "T_IDX") {
        const i = parseInt(text)-1;
        if (!u.goals[i]) return bot.sendMessage(id, s.err);
        u.tmp_idx = i; u.state = "T_A"; return bot.sendMessage(id, s.ent_a);
    }
    if (u.state === "T_A") {
        const a = parseFloat(text.replace(",", "."));
        if (isNaN(a)) return bot.sendMessage(id, s.err);
        u.goals[u.tmp_idx].collected += a;
        u.goals[u.tmp_idx].lastUpdate = new Date();
        u.state = "IDLE"; save();
        return bot.sendMessage(id, s.done, getMenu(u.lang));
    }

    // СНЯТИЕ ДЕНЕГ (Та самая функция)
    if (u.state === "O_IDX") {
        const i = parseInt(text)-1;
        if (!u.goals[i]) return bot.sendMessage(id, s.err);
        u.tmp_idx = i; u.state = "O_A"; return bot.sendMessage(id, s.ent_a);
    }
    if (u.state === "O_A") {
        const a = parseFloat(text.replace(",", "."));
        if (isNaN(a)) return bot.sendMessage(id, s.err);
        if (u.goals[u.tmp_idx].collected < a) return bot.sendMessage(id, s.low);
        
        u.goals[u.tmp_idx].collected -= a;
        u.state = "IDLE"; save();
        return bot.sendMessage(id, `📉 **-${a}**\n\n${s.done}`, getMenu(u.lang));
    }
});

// Умные уведомления (Пинок)
cron.schedule("0 10 * * *", () => {
    Object.values(db.users).forEach(u => {
        u.goals.forEach(g => {
            const days = (new Date() - new Date(g.lastUpdate || new Date())) / (1000*60*60*24);
            if (days > 3 && g.collected < g.goal) {
                bot.sendMessage(u.id, "🔔 **MORTISPAY:** Мы стоим на месте! Не забывай пополнять копилку.");
            }
        });
    });
}, { timezone: "Asia/Tashkent" });