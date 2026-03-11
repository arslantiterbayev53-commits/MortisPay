const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; // Арслан
const DB_FILE = "mortis_vault.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.get("/", (req, res) => res.send("🏦 MortisPay Vault Engine: Active"));
app.listen(process.env.PORT || 3000);

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
    welcome: "🏦 **MORTISPAY | ЦИФРОВАЯ КОПИЛКА**\n\nДобро пожаловать, {name}. Твой личный финансовый сейф готов к работе. Начни копить на свои мечты прямо сейчас.",
    m_my: "💰 Мои цели", m_add: "✨ Создать цель", m_top: "📥 Пополнить",
    m_del: "🗑 Удалить цель", m_stat: "📊 Статистика", m_hist: "📜 История",
    m_plan: "📈 Финплан", m_rem: "🔔 Уведомления", m_lang: "🌐 Язык",
    
    // Сообщения процесса
    no_g: "❌ У тебя пока нет активных целей.",
    ent_n: "🏷 Введи название (например: iPhone 17 Pro):",
    ent_s: "💵 Какую сумму нужно собрать? (только цифры):",
    ent_v: "💎 Выбери валюту накопления:",
    ent_a: "💳 Сколько хочешь внести прямо сейчас?",
    created: "✅ **ГОТОВО:** Цель создана!",
    added: "💰 **УСПЕХ:** Копилка пополнена!",
    deleted: "🗑 **УДАЛЕНО:** Цель стерта.",
    
    // Системное
    sel_g: "🔢 Выбери номер цели из списка:",
    err_num: "⚠️ Ошибка! Вводи только числа.",
    cron_msg: "☀️ **MORTISPAY:** Доброе утро! Не забудь пополнить свою копилку сегодня! 💸",
    news_head: "📢 **НОВОСТИ MORTISPAY:**",
    push_msg: "📥 **MORTISPAY ИНФО:** Самое время пополнить свой баланс! Используй кнопку 'Пополнить', чтобы стать ближе к цели. 💸",
    
    // Админка
    adm_main: "💎 **MORTISWEB | ADMIN PANEL**\n\n/users - Список юзеров\n/notify_all - Напомнить всем о пополнении 📥\n/broadcast - Срочная рассылка\n/schedule - Запланировать рассылку"
};

const getMenu = () => ({
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

    // Мгновенная регистрация без номера телефона
    if (!db.users[id]) {
        db.users[id] = { 
            id, 
            name: msg.from.first_name, 
            username: msg.from.username || "нет", 
            goals: [], 
            history: [], 
            state: "IDLE", 
            reminders: true 
        };
        db.system.totalUsers++;
        saveDB();
    }
    const u = db.users[id];

    if (text === "/start") {
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, UI.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getMenu() });
    }

    // --- 💎 ADMIN PANEL (Только для Арслана) ---
    if (id.toString() === MY_ID) {
        if (text === "/admin") return bot.sendMessage(id, UI.adm_main);
        
        if (text === "/users") {
            let list = `👥 **ВСЕГО ЮЗЕРОВ: ${db.system.totalUsers}**\n`;
            Object.values(db.users).forEach((v, i) => list += `\n${i+1}. ${v.name} (@${v.username}) | ID: ${v.id}`);
            return bot.sendMessage(id, list, { parse_mode: "Markdown" });
        }

        if (text === "/notify_all") {
            Object.values(db.users).forEach(user => {
                bot.sendMessage(user.id, UI.push_msg, { parse_mode: "Markdown" }).catch(() => {});
            });
            return bot.sendMessage(id, "✅ Уведомления о пополнении отправлены всем юзерам!");
        }

        if (text === "/broadcast") { 
            u.state = "ADM_BC"; saveDB(); 
            return bot.sendMessage(id, "📢 Введите текст сообщения для всех:"); 
        }

        if (text === "/schedule") { 
            u.state = "ADM_SCH_TIME"; saveDB(); 
            return bot.sendMessage(id, "🕒 Введите время в формате ЧЧ:ММ (напр. 15:40):"); 
        }

        // Обработка состояний админа
        if (u.state === "ADM_BC") {
            Object.values(db.users).forEach(user => {
                bot.sendMessage(user.id, `${UI.news_head}\n\n${text}`, { parse_mode: "Markdown" }).catch(() => {});
            });
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, "✅ Рассылка завершена!");
        }

        if (u.state === "ADM_SCH_TIME") {
            u.temp_time = text; u.state = "ADM_SCH_TEXT"; saveDB();
            return bot.sendMessage(id, "📝 Введите текст запланированной новости:");
        }

        if (u.state === "ADM_SCH_TEXT") {
            db.system.scheduledNews = { time: u.temp_time, text: text };
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, "🕒 Новость успешно запланирована.");
        }
    }

    // --- 💰 USER LOGIC ---
    if (u.state === "IDLE") {
        switch (text) {
            case UI.m_my:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let gMsg = `💰 **ТВОИ ЦЕЛИ:**\n`;
                u.goals.forEach((g, i) => {
                    let p = Math.min(Math.floor((g.collected / g.goal) * 100), 100);
                    gMsg += `\n${i+1}. **${g.title}**\n💵 ${g.collected}/${g.goal} ${g.currency}\n${getBar(p)} ${p}%\n`;
                });
                bot.sendMessage(id, gMsg, { parse_mode: "Markdown" });
                break;

            case UI.m_add: u.state = "A_N"; saveDB(); bot.sendMessage(id, UI.ent_n); break;

            case UI.m_top:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let tl = `${UI.sel_g}\n\n`; u.goals.forEach((g, i) => tl += `${i+1}. ${g.title}\n`);
                u.state = "T_I"; saveDB(); bot.sendMessage(id, tl);
                break;

            case UI.m_del:
                if (!u.goals.length) return bot.sendMessage(id, UI.no_g);
                let dl = `${UI.sel_g}\n\n`; u.goals.forEach((g, i) => dl += `${i+1}. ${g.title}\n`);
                u.state = "D_I"; saveDB(); bot.sendMessage(id, dl);
                break;

            case UI.m_stat:
                let totalS = u.goals.reduce((s, g) => s + g.collected, 0);
                bot.sendMessage(id, `📊 **СТАТИСТИКА:**\n\nАктивных целей: ${u.goals.length}\nВсего собрано: ${totalS} ${u.goals[0]?.currency || "USD"}`, { parse_mode: "Markdown" });
                break;

            case UI.m_hist:
                let h = u.history.length ? `${UI.hist_title}\n\n${u.history.slice(-10).join("\n")}` : "📜 История пуста.";
                bot.sendMessage(id, h, { parse_mode: "Markdown" });
                break;

            case UI.m_rem:
                bot.sendMessage(id, "🔔 Настройка уведомлений:", {
                    reply_markup: { keyboard: [["Включить", "Выключить"]], resize_keyboard: true }
                });
                break;
            case "Включить": u.reminders = true; saveDB(); bot.sendMessage(id, "✅ Напоминания в 08:00 включены.", getMenu()); break;
            case "Выключить": u.reminders = false; saveDB(); bot.sendMessage(id, "🔕 Напоминания выключены.", getMenu()); break;
        }
    } 
    // Обработка ввода для создания и пополнения целей
    else if (u.state === "A_N") { u.tmp_n = text; u.state = "A_S"; saveDB(); bot.sendMessage(id, UI.ent_s); }
    else if (u.state === "A_S") {
        const val = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(val)) return bot.sendMessage(id, UI.err_num);
        u.tmp_s = val; u.state = "A_C"; saveDB();
        bot.sendMessage(id, UI.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }
    else if (u.state === "A_C") {
        u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, currency: text });
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.created, getMenu());
    }
    else if (u.state === "T_I") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) return bot.sendMessage(id, UI.err_num);
        u.tmp_idx = idx; u.state = "T_S"; saveDB(); bot.sendMessage(id, UI.ent_a);
    }
    else if (u.state === "T_S") {
        const amt = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(amt)) return bot.sendMessage(id, UI.err_num);
        const g = u.goals[u.tmp_idx];
        g.collected += amt;
        u.history.push(`📥 +${amt} ${g.currency} | ${g.title} (${new Date().toLocaleDateString()})`);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.added, getMenu());
    }
    else if (u.state === "D_I") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) return bot.sendMessage(id, UI.err_num);
        u.goals.splice(idx, 1);
        u.state = "IDLE"; saveDB(); bot.sendMessage(id, UI.deleted, getMenu());
    }
});

// ==========================================
// ⏰ FIXED SCHEDULER (TASHKENT TIME)
// ==========================================

// Проверка запланированных рассылок каждую минуту
cron.schedule("* * * * *", () => {
    if (!db.system.scheduledNews) return;
    const now = new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
    
    if (db.system.scheduledNews.time === now) {
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, `${UI.news_head}\n\n${db.system.scheduledNews.text}`, { parse_mode: "Markdown" }).catch(() => {});
        });
        // Очищаем, чтобы не спамить повторно в ту же минуту
        db.system.scheduledNews = null; saveDB();
    }
}, { timezone: "Asia/Tashkent" });

// Утреннее напоминание ровно в 08:00
cron.schedule("0 8 * * *", () => {
    Object.values(db.users).forEach(u => {
        if (u.reminders !== false) bot.sendMessage(u.id, UI.cron_msg, { parse_mode: "Markdown" }).catch(() => {});
    });
}, { timezone: "Asia/Tashkent" });

console.log("--- MORTISPAY ENGINE V2.1: FINAL STABLE ---");