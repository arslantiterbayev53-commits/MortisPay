const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// CONFIGURATION & INITIALIZATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; // Арслан
const DB_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("MortisPay Engine 2026: Online 🚀"));
app.listen(PORT, () => console.log(`[SYSTEM] MortisPay Server Active`));

// ==========================================
// DATABASE LOGIC
// ==========================================
let db = { users: {}, scheduledTask: null };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE));
            if (!db.scheduledTask) db.scheduledTask = null;
        } catch (e) {
            db = { users: {}, scheduledTask: null };
        }
    }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
loadDB();

// ==========================================
// MULTILINGUAL ENGINE (RU, UZ, EN)
// ==========================================
const LANG = {
    RU: {
        welcome: "👋 Добро пожаловать в **MortisPay**, {name}!\nЭто твой личный цифровой сейф от студии MortisWeb.",
        m_my: "📊 Мои цели", m_add: "➕ Новая цель", m_top: "💰 Пополнить",
        m_del: "🗑 Удалить", m_stat: "📊 Статистика", m_hist: "📜 История",
        m_plan: "📈 План", m_rem: "🔔 Настройка уведомлений", m_lang: "🌐 Язык",
        no_g: "❌ У вас пока нет созданных целей.",
        ent_n: "🏷 Введите название цели:",
        ent_s: "💵 Какую сумму нужно собрать? (Цифрами):",
        ent_v: "💎 Выберите валюту:",
        ent_a: "💳 Какую сумму вы хотите внести сейчас?",
        created: "✅ Цель успешно создана!",
        added: "💰 Баланс цели успешно пополнен!",
        deleted: "🗑 Цель была полностью удалена.",
        rem_set: "🔔 Выберите частоту уведомлений (придут в 8:00 утра):",
        rem_on: "✅ Уведомления настроены!",
        rem_off: "🔕 Уведомления выключены.",
        rem_d: "Каждый день", rem_w: "Раз в неделю", rem_m: "Раз в месяц", rem_s: "Выключить",
        sel_g: "🔢 Выберите номер цели из вашего списка:",
        goal_done: "🎉 ПОЗДРАВЛЯЕМ! Вы достигли своей цели! 🏆",
        err_num: "⚠️ Ошибка! Введите корректное число.",
        cron_msg: "☀️ Доброе утро! Не забудьте пополнить свою цель сегодня! 💸",
        news_head: "📢 **НОВОСТИ ОБНОВЛЕНИЯ:**",
        hist_title: "📜 **История операций:**",
        hist_empty: "📜 Ваша история пока пуста.",
        stat_head: "📊 **Ваша статистика:**\n• Всего целей: {count}\n• Всего собрано: {total} {cur}",
        plan_head: "📈 **Финансовый план (1000 USD):**\n• 30 дней: 33.3$ / день\n• 60 дней: 16.6$ / день\n• 90 дней: 11.1$ / день",
        adm_main: "💎 **Админ-панель:**\n/users - Список\n/remindall - Напомнить всем\n/broadcast - Срочная рассылка\n/schedule - Запланировать рассылку",
        adm_time: "Введите время в формате ЧЧ:ММ (например 14:30):",
        adm_text: "Введите текст для запланированной рассылки:"
    },
    UZ: {
        welcome: "👋 **MortisPay**-ga xush kelibsiz, {name}!\nBu MortisWeb studiyasidan shaxsiy raqamli seyfingiz.",
        m_my: "📊 Maqsadlarim", m_add: "➕ Yangi maqsad", m_top: "💰 To'ldirish",
        m_del: "🗑 O'chirish", m_stat: "📊 Statistika", m_hist: "📜 Tarix",
        m_plan: "📈 Reja", m_rem: "🔔 Bildirishnomalar", m_lang: "🌐 Til",
        no_g: "❌ Sizda hozircha maqsadlar yo'q.",
        ent_n: "🏷 Maqsad nomini kiriting:",
        ent_s: "💵 Qancha yig'ish kerak? (Raqamda):",
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
        err_num: "⚠️ Xato! Iltimos faqat raqam kiriting.",
        cron_msg: "☀️ Xayrli tong! Bugun maqsadingizni to'ldirishni unutmang! 💸",
        news_head: "📢 **YANGILIKLAR:**",
        hist_title: "📜 **Operatsiyalar tarixi:**",
        hist_empty: "📜 Tarix hozircha bo'sh.",
        stat_head: "📊 **Sizning statistikangiz:**\n• Maqsadlar soni: {count}\n• Jami yig'ildi: {total} {cur}",
        plan_head: "📈 **Moliyaviy reja (1000 USD):**\n• 30 kun: 33.3$ / kun\n• 60 kun: 16.6$ / kun\n• 90 kun: 11.1$ / kun",
        adm_main: "💎 **Admin paneli:**\n/users - Ro'yxat\n/remindall - Eslatma\n/broadcast - Xabar yuborish\n/schedule - Rejalashtirish"
    },
    EN: {
        welcome: "👋 Welcome to **MortisPay**, {name}!",
        m_my: "📊 My Goals", m_add: "➕ New Goal", m_top: "💰 Top up",
        m_del: "🗑 Delete", m_stat: "📊 Stats", m_hist: "📜 History",
        m_plan: "📈 Plan", m_rem: "🔔 Reminders", m_lang: "🌐 Language",
        no_g: "❌ No goals yet.",
        ent_n: "🏷 Enter goal name:",
        ent_s: "💵 Target amount? (Numbers only):",
        ent_v: "💎 Select currency:",
        ent_a: "💳 How much to add now?",
        created: "✅ Goal created successfully!",
        added: "💰 Added successfully!",
        deleted: "🗑 Goal deleted.",
        rem_set: "🔔 Choose frequency (8:00 AM):",
        rem_on: "✅ Reminders set!",
        rem_off: "🔕 Disabled.",
        rem_d: "Daily", rem_w: "Weekly", rem_m: "Monthly", rem_s: "Off",
        sel_g: "🔢 Choose goal number:",
        goal_done: "🎉 CONGRATS! Goal achieved! 🏆",
        err_num: "⚠️ Error! Please enter a valid number.",
        cron_msg: "☀️ Good morning! Don't forget to save today! 💸",
        news_head: "📢 **NEW UPDATE:**",
        hist_title: "📜 **Transaction History:**",
        hist_empty: "📜 History is empty.",
        stat_head: "📊 **Your Stats:**\n• Total goals: {count}\n• Total saved: {total} {cur}",
        plan_head: "📈 **Financial Plan (1000 USD):**\n• 30 days: 33.3$ / day\n• 60 days: 16.6$ / day\n• 90 days: 11.1$ / day",
        adm_main: "💎 **Admin Panel:**\n/users - List\n/remindall - Ping all\n/broadcast - News\n/schedule - Scheduler"
    }
};

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
// CRON (NOT TOUCHED - WORKS AS REQUESTED)
// ==========================================
cron.schedule("0 8 * * *", () => {
    Object.values(db.users).forEach(u => {
        if (!u.rem_type || u.rem_type === "off") return;
        bot.sendMessage(u.id, LANG[u.lang].cron_msg).catch(() => {});
    });
}, { timezone: "Asia/Tashkent" });

cron.schedule("* * * * *", () => {
    if (!db.scheduledTask) return;
    const now = new Date();
    const curTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
    if (db.scheduledTask.time === curTime) {
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, `${LANG[u.lang].news_head}\n\n${db.scheduledTask.text}`).catch(() => {});
        });
        db.scheduledTask = null; saveDB();
    }
}, { timezone: "Asia/Tashkent" });

// ==========================================
// MAIN HANDLER
// ==========================================
bot.on("message", (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text) return;

    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, lang: "RU", goals: [], history: [], rem_type: "daily", state: "IDLE" };
        saveDB();
    }
    const u = db.users[id];
    const l = LANG[u.lang];

    if (text === "/start") {
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, l.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // --- ADMIN ---
    if (id.toString() === MY_ID) {
        if (text === "/admin") return bot.sendMessage(id, l.adm_main);
        if (text === "/schedule") { u.state = "ADM_S_T"; saveDB(); return bot.sendMessage(id, l.adm_time); }
        if (u.state === "ADM_S_T") { u.t_t = text; u.state = "ADM_S_X"; saveDB(); return bot.sendMessage(id, l.adm_text); }
        if (u.state === "ADM_S_X") {
            db.scheduledTask = { time: u.t_t, text: text };
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, "✅ Done.");
        }
    }

    // --- LOGIC BUTTONS ---
    switch (text) {
        case l.m_my:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let res = `🎯 **${l.m_my}:**\n`;
            u.goals.forEach((g, i) => {
                let p = Math.min(Math.floor((g.collected / g.goal) * 100), 100);
                let bar = "█".repeat(Math.floor(p / 10)) + "░".repeat(10 - Math.floor(p / 10));
                res += `\n${i + 1}. **${g.title}**\n💰 ${g.collected} / ${g.goal} ${g.currency}\n${bar} ${p}%\n`;
            });
            bot.sendMessage(id, res, { parse_mode: "Markdown" });
            break;

        case l.m_stat:
            let total = u.goals.reduce((s, g) => s + g.collected, 0);
            let cur = u.goals.length > 0 ? u.goals[0].currency : "USD";
            bot.sendMessage(id, l.stat_head.replace("{count}", u.goals.length).replace("{total}", total).replace("{cur}", cur), { parse_mode: "Markdown" });
            break;

        case l.m_hist:
            let h = u.history.length ? `${l.hist_title}\n\n${u.history.slice(-10).join("\n")}` : l.hist_empty;
            bot.sendMessage(id, h, { parse_mode: "Markdown" });
            break;

        case l.m_plan: bot.sendMessage(id, l.plan_head, { parse_mode: "Markdown" }); break;

        case l.m_lang:
            u.lang = (u.lang === "RU") ? "UZ" : (u.lang === "UZ" ? "EN" : "RU");
            saveDB(); bot.sendMessage(id, `🌐 Language: ${u.lang}`, getMenu(id));
            break;

        case l.m_add: u.state = "A_N"; saveDB(); bot.sendMessage(id, l.ent_n); break;
        
        case l.m_top:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let list = `${l.sel_g}\n\n`;
            u.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
            u.state = "T_I"; saveDB(); bot.sendMessage(id, list);
            break;

        case l.m_del:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let dList = `${l.sel_g}\n\n`;
            u.goals.forEach((g, i) => dList += `${i + 1}. ${g.title}\n`);
            u.state = "D_I"; saveDB(); bot.sendMessage(id, dList);
            break;

        case l.m_rem:
            bot.sendMessage(id, l.rem_set, { reply_markup: { keyboard: [[l.rem_d], [l.rem_w, l.rem_m], [l.rem_s]], resize_keyboard: true } });
            break;
            
        case l.rem_d: u.rem_type = "daily"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_w: u.rem_type = "weekly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_m: u.rem_type = "monthly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_s: u.rem_type = "off"; saveDB(); bot.sendMessage(id, l.rem_off, getMenu(id)); break;
    }

    // --- STATE PROCESSING (FIXED LOGIC) ---
    if (u.state === "A_N" && text !== l.m_add) { 
        u.tmp_n = text; u.state = "A_S"; saveDB(); bot.sendMessage(id, l.ent_s); 
    }
    else if (u.state === "A_S") {
        const s = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(s)) return bot.sendMessage(id, l.err_num);
        u.tmp_s = s; u.state = "A_C"; saveDB();
        bot.sendMessage(id, l.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }
    else if (u.state === "A_C") {
        u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, currency: text });
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, l.created, getMenu(id));
    }
    else if (u.state === "T_I") {
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, l.err_num);
        u.tmp_idx = idx; u.state = "T_S"; saveDB(); bot.sendMessage(id, l.ent_a);
    }
    else if (u.state === "T_S") {
        const val = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(val)) return bot.sendMessage(id, l.err_num);
        const g = u.goals[u.tmp_idx];
        g.collected += val;
        u.history.push(`+${val} ${g.currency} -> ${g.title} (${new Date().toLocaleDateString()})`);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, l.added, getMenu(id));
        if (g.collected >= g.goal) bot.sendMessage(id, l.goal_done);
    }
    else if (u.state === "D_I") {
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, l.err_num);
        u.goals.splice(idx, 1);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, l.deleted, getMenu(id));
    }
});

// Broadcast
bot.onText(/\/broadcast/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    bot.sendMessage(MY_ID, "Message for ALL:");
    bot.once("message", (msg) => {
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, `${LANG[u.lang].news_head}\n\n${msg.text}`, { parse_mode: "Markdown" }).catch(() => {});
        });
        bot.sendMessage(MY_ID, "✅ Sent to all.");
    });
});

console.log("MortisPay ULTIMATE 2026 Ready.");