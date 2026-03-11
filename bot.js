const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// CONFIGURATION & INITIALIZATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; // ID Арслана
const DB_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Server for Render deployment
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("MortisPay Engine PRO: Running 🚀"));
app.listen(PORT, () => console.log(`[SYSTEM] Server active on port ${PORT}`));

// ==========================================
// DATABASE LOGIC
// ==========================================
let db = { users: {} };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE));
            console.log("[DB] Data successfully synchronized");
        } catch (e) {
            console.error("[DB] Load error, resetting...");
            db = { users: {} };
        }
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

loadDB();

// ==========================================
// MULTILINGUAL ENGINE (RU, UZ, EN)
// ==========================================
const LANG = {
    RU: {
        welcome: "👋 Добро пожаловать в **MortisPay**, {name}!",
        m_my: "📊 Мои цели", m_add: "➕ Новая цель", m_top: "💰 Пополнить",
        m_del: "🗑 Удалить", m_stat: "📊 Статистика", m_hist: "📜 История",
        m_plan: "📈 План", m_rem: "🔔 Настройка уведомлений", m_lang: "🌐 Язык",
        no_g: "❌ У вас пока нет созданных целей.",
        ent_n: "🏷 Введите название цели (например: iPhone 15):",
        ent_s: "💵 Какую сумму нужно собрать? (Введите только число):",
        ent_v: "💎 Выберите валюту для этой цели:",
        ent_a: "💳 Какую сумму вы хотите внести сейчас?",
        created: "✅ Цель успешно создана! Начните копить прямо сейчас.",
        added: "💰 Баланс цели успешно пополнен!",
        deleted: "🗑 Цель была полностью удалена.",
        rem_set: "🔔 Выберите частоту уведомлений (придут в 8:00 утра):",
        rem_on: "✅ Уведомления настроены! Я буду напоминать вам вовремя.",
        rem_off: "🔕 Уведомления выключены.",
        rem_d: "Каждый день", rem_w: "Раз в неделю", rem_m: "Раз в месяц", rem_s: "Выключить",
        sel_g: "🔢 Выберите номер цели из вашего списка:",
        goal_done: "🎉 ПОЗДРАВЛЯЕМ! Вы достигли своей цели! 🏆",
        err_num: "⚠️ Ошибка! Пожалуйста, введите корректное число (без букв).",
        cron_msg: "☀️ Доброе утро! Не забудьте пополнить свою цель в MortisPay сегодня! 💸",
        admin_rem: "📣 Новое объявление: Пожалуйста, не забудьте пополнить свои цели сегодня! 🚀"
    },
    UZ: {
        welcome: "👋 **MortisPay**-ga xush kelibsiz, {name}!",
        m_my: "📊 Maqsadlarim", m_add: "➕ Yangi maqsad", m_top: "💰 To'ldirish",
        m_del: "🗑 O'chirish", m_stat: "📊 Statistika", m_hist: "📜 Tarix",
        m_plan: "📈 Reja", m_rem: "🔔 Bildirishnomalar", m_lang: "🌐 Til",
        no_g: "❌ Sizda hozircha maqsadlar yo'q.",
        ent_n: "🏷 Maqsad nomini kiriting (masalan: Yangi telefon):",
        ent_s: "💵 Qancha yig'ish kerak? (Faqat raqam kiriting):",
        ent_v: "💎 Valyutani tanlang:",
        ent_a: "💳 Qancha summa qo'shmoqchisiz?",
        created: "✅ Maqsad muvaffaqiyatli yaratildi!",
        added: "💰 Maqsad balansi to'ldirildi!",
        deleted: "🗑 Maqsad o'chirib tashlandi.",
        rem_set: "🔔 Bildirishnoma chastotasini tanlang (soat 8:00 da):",
        rem_on: "✅ Bildirishnomalar sozlandi!",
        rem_off: "🔕 Bildirishnomalar o'chirildi.",
        rem_d: "Har kuni", rem_w: "Haftada bir", rem_m: "Oyda bir", rem_s: "O'chirish",
        sel_g: "🔢 Ro'yxatdan maqsad raqamini tanlang:",
        goal_done: "🎉 TABRIKLAYMIZ! Siz maqsadingizga erishdingiz! 🏆",
        err_num: "⚠️ Xato! Iltimos faqat raqam kiriting (harflarsiz).",
        cron_msg: "☀️ Xayrli tong! Bugun MortisPay-da maqsadingizni to'ldirishni unutmang! 💸",
        admin_rem: "📣 Yangi e'lon: Iltimos, bugun maqsadlaringizni to'ldirishni unutmang! 🚀"
    },
    EN: {
        welcome: "👋 Welcome to **MortisPay**, {name}!",
        m_my: "📊 My Goals", m_add: "➕ New Goal", m_top: "💰 Top up",
        m_del: "🗑 Delete", m_stat: "📊 Stats", m_hist: "📜 History",
        m_plan: "📈 Plan", m_rem: "🔔 Reminders", m_lang: "🌐 Language",
        no_g: "❌ You don't have any goals yet.",
        ent_n: "🏷 Enter goal name:",
        ent_s: "💵 Target amount? (Numbers only):",
        ent_v: "💎 Select currency:",
        ent_a: "💳 How much to add?",
        created: "✅ Goal created successfully!",
        added: "💰 Added successfully!",
        deleted: "🗑 Goal deleted.",
        rem_set: "🔔 Choose frequency (8:00 AM):",
        rem_on: "✅ Reminders set!",
        rem_off: "🔕 Reminders off.",
        rem_d: "Daily", rem_w: "Weekly", rem_m: "Monthly", rem_s: "Off",
        sel_g: "🔢 Choose goal number:",
        goal_done: "🎉 CONGRATS! Goal achieved! 🏆",
        err_num: "⚠️ Error! Please enter a valid number.",
        cron_msg: "☀️ Good morning! Don't forget to save today in MortisPay! 💸",
        admin_rem: "📣 New Announcement: Please don't forget to top up your goals today! 🚀"
    }
};

// ==========================================
// CORE HELPERS
// ==========================================

function getMenu(id) {
    const u = db.users[id];
    const l = LANG[u.lang || "RU"];
    return {
        reply_markup: {
            keyboard: [
                [l.m_my], [l.m_add, l.m_top],
                [l.m_del, l.m_stat], [l.m_hist, l.m_plan],
                [l.m_rem, l.m_lang]
            ], resize_keyboard: true
        }
    };
}

// ==========================================
// CRON SCHEDULER (Daily at 8:00 AM)
// ==========================================
cron.schedule("0 8 * * *", () => {
    const today = new Date();
    Object.values(db.users).forEach(u => {
        if (!u.rem_type || u.rem_type === "off") return;
        
        let shouldSend = false;
        if (u.rem_type === "daily") shouldSend = true;
        if (u.rem_type === "weekly" && today.getDay() === 1) shouldSend = true;
        if (u.rem_type === "monthly" && today.getDate() === 1) shouldSend = true;
        
        if (shouldSend) {
            bot.sendMessage(u.id, LANG[u.lang].cron_msg).catch(() => {});
        }
    });
});

// ==========================================
// MAIN MESSAGE HANDLER
// ==========================================

bot.on("message", (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text) return;

    // Registration
    if (!db.users[id]) {
        db.users[id] = {
            id, name: msg.from.first_name, username: msg.from.username || "none",
            lang: "RU", goals: [], history: [], rem_type: "daily", state: "IDLE"
        };
        saveDB();
        bot.sendMessage(MY_ID, `🚀 [NEW USER] ${msg.from.first_name} (@${msg.from.username}) joined.`);
    }

    const u = db.users[id];
    const l = LANG[u.lang];

    // Global Command
    if (text === "/start") {
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, l.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // ADMIN AREA
    if (id.toString() === MY_ID) {
        if (text === "/admin") {
            return bot.sendMessage(id, "💎 **MortisPay Control Panel**\n\n/users - List all\n/remindall - Short ping\n/broadcast - Custom message", { parse_mode: "Markdown" });
        }
        if (text === "/remindall") {
            Object.values(db.users).forEach(usr => bot.sendMessage(usr.id, LANG[usr.lang].admin_rem).catch(() => {}));
            return bot.sendMessage(id, "✅ Short reminder sent to all users.");
        }
    }

    // STATE HANDLING (Input Validations)
    if (u.state === "AWAIT_NAME") {
        u.tmp_name = text; u.state = "AWAIT_SUM"; saveDB();
        return bot.sendMessage(id, l.ent_s);
    }

    if (u.state === "AWAIT_SUM") {
        const sum = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(sum) || sum <= 0) return bot.sendMessage(id, l.err_num);
        u.tmp_sum = sum; u.state = "AWAIT_CURR"; saveDB();
        return bot.sendMessage(id, l.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }

    if (u.state === "AWAIT_CURR") {
        const currs = ["USD", "RUB", "UZS"];
        if (!currs.includes(text)) return bot.sendMessage(id, "Error: Use buttons");
        u.goals.push({ title: u.tmp_name, goal: u.tmp_sum, collected: 0, currency: text });
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, l.created, getMenu(id));
    }

    if (u.state === "AWAIT_TOPUP_ID") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) return bot.sendMessage(id, l.err_num);
        u.tmp_idx = idx; u.state = "AWAIT_TOPUP_SUM"; saveDB();
        return bot.sendMessage(id, l.ent_a);
    }

    if (u.state === "AWAIT_TOPUP_SUM") {
        const val = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(val) || val <= 0) return bot.sendMessage(id, l.err_num);
        const g = u.goals[u.tmp_idx];
        g.collected += val;
        u.history.push(`+${val} ${g.currency} -> ${g.title} (${new Date().toLocaleDateString()})`);
        u.state = "IDLE"; saveDB();
        bot.sendMessage(id, l.added, getMenu(id));
        if (g.collected >= g.goal) bot.sendMessage(id, l.goal_done);
        return;
    }

    if (u.state === "AWAIT_DEL_ID") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) return bot.sendMessage(id, l.err_num);
        u.goals.splice(idx, 1);
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, l.deleted, getMenu(id));
    }

    // MAIN BUTTONS
    switch (text) {
        case l.m_my:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let res = `🎯 **${l.m_my}:**\n`;
            u.goals.forEach((g, i) => {
                let p = Math.floor((g.collected / g.goal) * 100);
                if (p > 100) p = 100;
                let bar = "█".repeat(Math.floor(p / 10)) + "░".repeat(10 - Math.floor(p / 10));
                res += `\n${i + 1}. **${g.title}**\n💰 ${g.collected} / ${g.goal} ${g.currency}\n${bar} ${p}%\n`;
            });
            bot.sendMessage(id, res, { parse_mode: "Markdown" });
            break;

        case l.m_add: u.state = "AWAIT_NAME"; saveDB(); bot.sendMessage(id, l.ent_n); break;

        case l.m_top:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let tList = `${l.sel_g}\n\n`;
            u.goals.forEach((g, i) => tList += `${i + 1}. ${g.title}\n`);
            u.state = "AWAIT_TOPUP_ID"; saveDB(); bot.sendMessage(id, tList);
            break;

        case l.m_del:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let dList = `${l.sel_g}\n\n`;
            u.goals.forEach((g, i) => dList += `${i + 1}. ${g.title}\n`);
            u.state = "AWAIT_DEL_ID"; saveDB(); bot.sendMessage(id, dList);
            break;

        case l.m_rem:
            bot.sendMessage(id, l.rem_set, {
                reply_markup: {
                    keyboard: [[l.rem_d], [l.rem_w, l.rem_m], [l.rem_s]],
                    resize_keyboard: true
                }
            });
            break;

        case l.rem_d: u.rem_type = "daily"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_w: u.rem_type = "weekly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_m: u.rem_type = "monthly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_s: u.rem_type = "off"; saveDB(); bot.sendMessage(id, l.rem_off, getMenu(id)); break;

        case l.m_lang:
            const next = u.lang === "RU" ? "UZ" : (u.lang === "UZ" ? "EN" : "RU");
            u.lang = next; saveDB();
            const feedback = u.lang === "RU" ? "🇷🇺 Язык изменен" : (u.lang === "UZ" ? "🇺🇿 Til o'zgartirildi" : "🇺🇸 Language changed");
            bot.sendMessage(id, feedback, getMenu(id));
            break;

        case l.m_stat:
            let total = u.goals.reduce((s, g) => s + g.collected, 0);
            bot.sendMessage(id, `📊 **Stats:**\nGoals: ${u.goals.length}\nTotal Saved: ${total}`, { parse_mode: "Markdown" });
            break;

        case l.m_plan:
            bot.sendMessage(id, "📈 **1000 USD Plan:**\n• 30 days: 33.3$ / day\n• 60 days: 16.6$ / day\n• 90 days: 11.1$ / day", { parse_mode: "Markdown" });
            break;

        case l.m_hist:
            bot.sendMessage(id, u.history.length ? `📜 **History:**\n\n${u.history.slice(-10).join("\n")}` : "Empty", { parse_mode: "Markdown" });
            break;
    }
});

// Admin Core Commands
bot.onText(/\/users/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    let list = "👤 **Users:**\n";
    Object.values(db.users).forEach(usr => list += `• ${usr.name} (@${usr.username})\n`);
    bot.sendMessage(MY_ID, list, { parse_mode: "Markdown" });
});

bot.onText(/\/broadcast/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    bot.sendMessage(MY_ID, "Enter message for ALL users:");
    bot.once("message", (msg) => {
        Object.values(db.users).forEach(u => bot.sendMessage(u.id, "📢 **NEWS:**\n\n" + msg.text, { parse_mode: "Markdown" }).catch(() => {}));
        bot.sendMessage(MY_ID, "✅ Broadcast complete.");
    });
});

console.log("===============================");
console.log("MortisPay PRO 2026 Engine Active");
console.log("Developed for Arslan");
console.log("===============================");