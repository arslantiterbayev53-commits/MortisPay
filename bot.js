const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// ⚙️ CONFIGURATION & CREDENTIALS
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; // Твой ID (Арслан)
const DB_FILE = "mortis_vault.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Server for hosting (keep-alive)
app.get("/", (req, res) => res.send("🏦 MortisPay Vault Engine: Active"));
app.listen(process.env.PORT || 3000, () => console.log("Vault Server Started"));

// ==========================================
// 💾 DATABASE SYSTEM
// ==========================================
let db = { users: {}, system: { totalUsers: 0, scheduledNews: null } };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE));
        } catch (e) { console.error("DB Load Error"); }
    }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
loadDB();

// ==========================================
// 🎭 UI & TERMINOLOGY
// ==========================================
const UI = {
    welcome: "🏦 **MORTISPAY | ЦИФРОВАЯ КОПИЛКА**\n\nДобро пожаловать, {name}. Твой личный финансовый сейф готов к работе. Начни копить на свои мечты прямо сейчас.\n\n📈 **СТАТУС:** Активен\n🔐 **БЕЗОПАСНОСТЬ:** Включена",
    reg_req: "⚠️ **ВНИМАНИЕ:**\nДля активации системы накоплений, нажми кнопку ниже, чтобы подтвердить свою личность и номер телефона.",
    reg_btn: "📲 Подтвердить номер телефона",
    
    // Кнопки меню
    m_my: "💰 Мои цели", m_add: "✨ Создать цель", m_top: "📥 Пополнить",
    m_del: "🗑 Удалить цель", m_stat: "📊 Статистика", m_hist: "📜 История",
    m_plan: "📈 Финплан", m_rem: "🔔 Уведомления", m_lang: "🌐 Язык",

    // Сообщения процесса
    no_g: "❌ У тебя пока нет активных целей для накопления.",
    ent_n: "🏷 Введи название (например: iPhone 17 Pro):",
    ent_s: "💵 Какую сумму нужно собрать? (только цифры):",
    ent_v: "💎 Выбери валюту накопления:",
    ent_a: "💳 Сколько хочешь внести прямо сейчас?",
    created: "✅ **ГОТОВО:** Цель создана! Начинаем копить.",
    added: "💰 **УСПЕХ:** Копилка пополнена. Еще один шаг к цели!",
    deleted: "🗑 **УДАЛЕНО:** Цель была стерта из системы.",
    
    // Уведомления
    rem_set: "🔔 Выбери, как часто напоминать тебе о накоплениях (8:00):",
    rem_on: "✅ Уведомления настроены!",
    rem_off: "🔕 Уведомления выключены.",
    rem_d: "Каждый день", rem_w: "Раз в неделю", rem_m: "Раз в месяц", rem_s: "Выключить",
    
    // Системное
    sel_g: "🔢 Выбери номер цели из списка:",
    goal_done: "🎉 **ПОЗДРАВЛЯЕМ!** Сумма собрана! Ты сделал это! 🏆",
    err_num: "⚠️ Ошибка! Вводи только числа.",
    cron_msg: "☀️ Доброе утро! Не забудь пополнить свою копилку сегодня! Каждая монета важна. 💸",
    news_head: "📢 **НОВОСТИ MORTISPAY:**",
    hist_title: "📜 **ИСТОРИЯ ОПЕРАЦИЙ:**",
    hist_empty: "📜 Твоя история пока пуста.",
    stat_head: "📊 **ТВОЯ СТАТИСТИКА:**\n\n• Активных целей: {count}\n• Всего накоплено: {total} {cur}",
    plan_head: "📈 **КАК НАКОПИТЬ 1000$:**\n\n• Быстро (30 дн): 33.3$ / день\n• Средне (60 дн): 16.6$ / день\n• Спокойно (90 дн): 11.1$ / день",
    
    // Админка
    adm_main: "💎 **MORTISWEB | ADMIN PANEL**\n\n/users - Кто пользуется ботом\n/broadcast - Написать всем\n/schedule - Таймер новости",
    adm_time: "🕒 Введи время (например 15:40):",
    adm_text: "📝 Введи текст рассылки:"
};

// ==========================================
// 🛠 UTILS
// ==========================================
const getMenu = (id) => ({
    reply_markup: {
        keyboard: [
            [UI.m_my], [UI.m_add, UI.m_top],
            [UI.m_del, UI.m_stat], [UI.m_hist, UI.m_plan],
            [UI.m_rem, UI.m_lang]
        ], resize_keyboard: true
    }
});

const getBar = (p) => {
    const filled = Math.min(Math.floor(p / 10), 10);
    return "🟩".repeat(filled) + "⬜".repeat(10 - filled);
};

// ==========================================
// 🚀 MAIN ENGINE
// ==========================================
bot.on("message", (msg) => {
    const id = msg.from.id;
    const text = msg.text;

    // Регистрация в базе
    if (!db.users[id]) {
        db.users[id] = { 
            id, 
            name: msg.from.first_name, 
            username: msg.from.username || "нет", 
            phone: null, 
            goals: [], 
            history: [], 
            state: "REG_PHONE" 
        };
        db.system.totalUsers++;
        saveDB();
    }

    const u = db.users[id];

    // Прием контакта (телефона)
    if (msg.contact && u.state === "REG_PHONE") {
        u.phone = msg.contact.phone_number;
        u.state = "IDLE";
        saveDB();
        return bot.sendMessage(id, UI.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // Обработка /start
    if (text === "/start") {
        if (!u.phone) {
            return bot.sendMessage(id, UI.reg_req, {
                parse_mode: "Markdown",
                reply_markup: {
                    keyboard: [[{ text: UI.reg_btn, request_contact: true }]],
                    resize_keyboard: true, one_time_keyboard: true
                }
            });
        }
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, UI.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu(id) });
    }

    // --- 💎 АДМИН ПАНЕЛЬ (Только для Арслана) ---
    if (id.toString() === MY_ID) {
        if (text === "/admin") return bot.sendMessage(id, UI.adm_main);

        if (text === "/users") {
            let list = "👥 **СПИСОК ЮЗЕРОВ:**\n";
            Object.values(db.users).forEach((v, i) => {
                list += `\n${i+1}. ${v.name} (@${v.username})\n📞 ${v.phone || "нет"}\n🆔 ${v.id}\n`;
            });
            return bot.sendMessage(id, list, { parse_mode: "Markdown" });
        }

        if (text === "/broadcast") {
            u.state = "ADM_BC"; saveDB();
            return bot.sendMessage(id, "📢 Введи текст сообщения для всех пользователей:");
        }

        if (u.state === "ADM_BC") {
            Object.values(db.users).forEach(user => {
                bot.sendMessage(user.id, `${UI.news_head}\n\n${text}`, { parse_mode: "Markdown" }).catch(() => {});
            });
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, "✅ Сообщение успешно отправлено всем!");
        }

        if (text === "/schedule") { u.state = "ADM_S_T"; saveDB(); return bot.sendMessage(id, UI.adm_time); }
        if (u.state === "ADM_S_T") { u.t_t = text; u.state = "ADM_S_X"; saveDB(); return bot.sendMessage(id, UI.adm_text); }
        if (u.state === "ADM_S_X") {
            db.system.scheduledNews = { time: u.t_t, text: text };
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, "🕒 Новость запланирована.");
        }
    }

    // --- 💰 ЛОГИКА КОПИЛКИ ---
    if (u.state === "IDLE") {
        switch (text) {
            case UI.m_my:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let goalsMsg = `💰 **ТВОИ ЦЕЛИ:**\n`;
                u.goals.forEach((g, i) => {
                    let p = Math.min(Math.floor((g.collected / g.goal) * 100), 100);
                    goalsMsg += `\n${i + 1}. **${g.title}**\n💵 ${g.collected} / ${g.goal} ${g.currency}\n${getBar(p)} ${p}%\n`;
                });
                bot.sendMessage(id, goalsMsg, { parse_mode: "Markdown" });
                break;

            case UI.m_stat:
                let totalSum = u.goals.reduce((s, g) => s + g.collected, 0);
                let currency = u.goals.length > 0 ? u.goals[0].currency : "USD";
                bot.sendMessage(id, UI.stat_head.replace("{count}", u.goals.length).replace("{total}", totalSum).replace("{cur}", currency), { parse_mode: "Markdown" });
                break;

            case UI.m_hist:
                let hist = u.history.length ? `${UI.hist_title}\n\n${u.history.slice(-10).join("\n")}` : UI.hist_empty;
                bot.sendMessage(id, hist, { parse_mode: "Markdown" });
                break;

            case UI.m_add: u.state = "A_N"; saveDB(); bot.sendMessage(id, UI.ent_n); break;
            
            case UI.m_top:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let list = `${UI.sel_g}\n\n`;
                u.goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
                u.state = "T_I"; saveDB(); bot.sendMessage(id, list);
                break;

            case UI.m_del:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let delList = `${UI.sel_g}\n\n`;
                u.goals.forEach((g, i) => delList += `${i + 1}. ${g.title}\n`);
                u.state = "D_I"; saveDB(); bot.sendMessage(id, delList);
                break;

            case UI.m_plan: bot.sendMessage(id, UI.plan_head, { parse_mode: "Markdown" }); break;
            case UI.m_rem: bot.sendMessage(id, UI.rem_set, { reply_markup: { keyboard: [[UI.rem_d], [UI.rem_w, UI.rem_m], [UI.rem_s]], resize_keyboard: true } }); break;
            case UI.rem_d: case UI.rem_w: case UI.rem_m: bot.sendMessage(id, UI.rem_on, getMenu(id)); break;
            case UI.rem_s: bot.sendMessage(id, UI.rem_off, getMenu(id)); break;
        }
    } 
    
    // --- 📝 ОБРАБОТКА ВВОДА (STATE MACHINE) ---
    else if (u.state === "A_N") { u.tmp_n = text; u.state = "A_S"; saveDB(); bot.sendMessage(id, UI.ent_s); }
    else if (u.state === "A_S") {
        const val = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(val)) return bot.sendMessage(id, UI.err_num);
        u.tmp_s = val; u.state = "A_C"; saveDB();
        bot.sendMessage(id, UI.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }
    else if (u.state === "A_C") {
        u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, currency: text });
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.created, getMenu(id));
    }
    else if (u.state === "T_I") {
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, UI.err_num);
        u.tmp_idx = idx; u.state = "T_S"; saveDB(); bot.sendMessage(id, UI.ent_a);
    }
    else if (u.state === "T_S") {
        const amount = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(amount)) return bot.sendMessage(id, UI.err_num);
        const target = u.goals[u.tmp_idx];
        target.collected += amount;
        u.history.push(`📥 +${amount} ${target.currency} на "${target.title}" (${new Date().toLocaleDateString()})`);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.added, getMenu(id));
        if (target.collected >= target.goal) bot.sendMessage(id, UI.goal_done);
    }
    else if (u.state === "D_I") {
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, UI.err_num);
        u.goals.splice(idx, 1);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.deleted, getMenu(id));
    }
});

// ==========================================
// ⏰ ТАЙМЕРЫ (TASHKENT TIME)
// ==========================================
cron.schedule("* * * * *", () => {
    if (!db.system.scheduledNews) return;
    const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
    if (db.system.scheduledNews.time === now) {
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, `${UI.news_head}\n\n${db.system.scheduledNews.text}`, { parse_mode: "Markdown" }).catch(() => {});
        });
        db.system.scheduledNews = null; saveDB();
    }
}, { timezone: "Asia/Tashkent" });

// Утреннее напоминание в 8:00
cron.schedule("0 8 * * *", () => {
    Object.values(db.users).forEach(u => {
        bot.sendMessage(u.id, UI.cron_msg).catch(() => {});
    });
}, { timezone: "Asia/Tashkent" });

console.log("MortisPay Vault 2026 Engine Ready.");