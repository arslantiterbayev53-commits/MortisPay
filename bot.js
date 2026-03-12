const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = 6736116111; 
const DB_FILE = "mortis_vault.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.get("/", (req, res) => res.send("🏦 MortisPay Engine: Active"));
app.listen(process.env.PORT || 3000);

// ==========================================
// 💾 DATABASE & LOCALIZATION
// ==========================================
let db = { users: {}, system: { totalUsers: 0 } };

const STRINGS = {
    ru: {
        welcome: "🏦 **MORTISPAY | VAULT**\n\nДобро пожаловать, {name}. Твой личный сейф готов.",
        m_my: "💰 Мои цели", m_add: "✨ Создать", m_top: "📥 Пополнить",
        m_del: "🗑 Удалить", m_stat: "📊 Статистика", m_hist: "📜 История",
        m_plan: "📈 Финплан", m_rem: "🔔 Уведомления", m_lang: "🌐 Язык",
        no_g: "❌ У тебя пока нет активных целей.",
        ent_n: "🏷 Введи название цели:", ent_s: "💵 Какую сумму собрать?",
        ent_v: "💎 Выбери валюту:", ent_a: "💳 Сколько вносишь?",
        created: "✅ Цель создана!", added: "💰 Пополнено!", deleted: "🗑 Удалено.",
        err_num: "⚠️ Вводи только положительные числа!",
        plan_head: "📈 **ФИНАНСОВЫЙ ПЛАН:**",
        adm_head: "💎 **АДМИН ПАНЕЛЬ**",
        cron_msg: "☀️ **MORTISPAY:** Доброе утро! Время пополнить копилку! 💸"
    },
    en: {
        welcome: "🏦 **MORTISPAY | VAULT**\n\nWelcome, {name}. Your personal safe is ready.",
        m_my: "💰 My Goals", m_add: "✨ Create", m_top: "📥 Deposit",
        m_del: "🗑 Delete", m_stat: "📊 Statistics", m_hist: "📜 History",
        m_plan: "📈 FinPlan", m_rem: "🔔 Alerts", m_lang: "🌐 Language",
        no_g: "❌ You have no active goals.",
        ent_n: "🏷 Enter goal name:", ent_s: "💵 Target amount?",
        ent_v: "💎 Choose currency:", ent_a: "💳 Deposit amount?",
        created: "✅ Goal created!", added: "💰 Deposited!", deleted: "🗑 Deleted.",
        err_num: "⚠️ Please enter positive numbers only!",
        plan_head: "📈 **FINANCIAL PLAN:**",
        adm_head: "💎 **ADMIN PANEL**",
        cron_msg: "☀️ **MORTISPAY:** Good morning! Don't forget to save today! 💸"
    }
};

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { console.error("DB Error"); }
    }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
loadDB();

const getMenu = (lang) => {
    const s = STRINGS[lang] || STRINGS.ru;
    return {
        reply_markup: {
            keyboard: [
                [s.m_my], [s.m_add, s.m_top],
                [s.m_del, s.m_stat], [s.m_hist, s.m_plan],
                [s.m_rem, s.m_lang]
            ], resize_keyboard: true
        }
    };
};

const getBar = (p) => "🟩".repeat(Math.min(Math.floor(p / 10), 10)) + "⬜".repeat(10 - Math.min(Math.floor(p / 10), 10));

// ==========================================
// 🚀 MAIN ENGINE
// ==========================================
bot.on("message", (msg) => {
    if (!msg.from || !msg.text) return;
    const id = msg.from.id;
    const text = msg.text;

    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, goals: [], history: [], state: "IDLE", reminders: true, lang: "ru" };
        db.system.totalUsers++;
        saveDB();
    }
    const u = db.users[id];
    const s = STRINGS[u.lang] || STRINGS.ru;

    // --- 💎 ADMIN ---
    if (id === MY_ID && text === "/admin") {
        return bot.sendMessage(id, `${s.adm_head}\n\n👤 Юзеров: ${db.system.totalUsers}\n⚙️ Статус: OK`);
    }

    if (text === "/start") {
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, s.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu(u.lang) });
    }

    if (u.state === "IDLE") {
        switch (text) {
            case s.m_my:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                let gList = `💰 **${s.m_my}:**\n`;
                u.goals.forEach((g, i) => {
                    let p = Math.min(Math.floor((g.collected / g.goal) * 100), 100);
                    gList += `\n${i+1}. ${g.title}\n${g.collected}/${g.goal} ${g.currency}\n${getBar(p)} ${p}%\n`;
                });
                bot.sendMessage(id, gList, { parse_mode: "Markdown" });
                break;

            case s.m_add: u.state = "A_N"; saveDB(); bot.sendMessage(id, s.ent_n); break;
            
            case s.m_top:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                u.state = "T_I"; saveDB(); bot.sendMessage(id, u.lang === 'ru' ? "Номер цели:" : "Goal number:"); break;

            case s.m_del:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                u.state = "D_I"; saveDB(); bot.sendMessage(id, u.lang === 'ru' ? "Номер для удаления:" : "Number to delete:"); break;

            case s.m_stat:
                let totalC = u.goals.reduce((acc, g) => acc + g.collected, 0);
                bot.sendMessage(id, `📊 ${s.m_stat}:\n\nGoals: ${u.goals.length}\nTotal: ${totalC}`); break;

            case s.m_plan:
                if (!u.goals.length) return bot.sendMessage(id, s.no_g);
                const tG = u.goals.reduce((acc, g) => acc + g.goal, 0);
                const tC = u.goals.reduce((acc, g) => acc + g.collected, 0);
                const totalP = Math.min(Math.floor((tC / tG) * 100), 100);
                bot.sendMessage(id, `${s.plan_head}\n\nTarget: ${tG}\nSaved: ${tC}\nLeft: ${tG - tC}\n\n${getBar(totalP)} ${totalP}%`, { parse_mode: "Markdown" });
                break;

            case s.m_lang:
                u.state = "SET_LANG"; saveDB();
                bot.sendMessage(id, "🌍 Language:", { reply_markup: { keyboard: [["🇷🇺 Русский", "🇺🇸 English"]], resize_keyboard: true } }); break;

            case s.m_hist:
                const hText = u.history.length ? `📜 **${s.m_hist}:**\n\n${u.history.slice(-10).join("\n")}` : (u.lang === 'ru' ? "Пусто" : "Empty");
                bot.sendMessage(id, hText, { parse_mode: "Markdown" }); break;
        }
    } 
    else if (u.state === "SET_LANG") {
        u.lang = text.includes("Русский") ? "ru" : "en";
        u.state = "IDLE"; saveDB();
        bot.sendMessage(id, "✅ OK", getMenu(u.lang));
    }
    else if (u.state === "A_N") { u.tmp_n = text; u.state = "A_S"; saveDB(); bot.sendMessage(id, s.ent_s); }
    else if (u.state === "A_S") {
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0) return bot.sendMessage(id, s.err_num);
        u.tmp_s = val; u.state = "A_C"; saveDB();
        bot.sendMessage(id, s.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }
    else if (u.state === "A_C") {
        u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, currency: text });
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, s.created, getMenu(u.lang));
    }
    else if (u.state === "T_I") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) { bot.sendMessage(id, "Error"); u.state = "IDLE"; return; }
        u.tmp_idx = idx; u.state = "T_S"; saveDB(); bot.sendMessage(id, s.ent_a);
    }
    else if (u.state === "T_S") {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt <= 0) return bot.sendMessage(id, s.err_num);
        const g = u.goals[u.tmp_idx];
        g.collected += amt;
        u.history.push(`📥 +${amt} ${g.currency} | ${g.title}`);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, s.added, getMenu(u.lang));
    }
    else if (u.state === "D_I") {
        const idx = parseInt(text) - 1;
        if (u.goals[idx]) { u.goals.splice(idx, 1); bot.sendMessage(id, s.deleted); }
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, "---", getMenu(u.lang));
    }
});

cron.schedule("0 8 * * *", () => {
    Object.values(db.users).forEach(user => {
        if (user.reminders) bot.sendMessage(user.id, STRINGS[user.lang].cron_msg, { parse_mode: "Markdown" }).catch(() => {});
    });
}, { timezone: "Asia/Tashkent" });