const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// КОНФИГУРАЦИЯ (Арслан, проверь ID и Токен)
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; 
const DB_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Для работы на Render
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("MortisPay PRO Engine: Active 🚀"));
app.listen(PORT, () => console.log(`[SYSTEM] Port: ${PORT}`));

// ==========================================
// БАЗА ДАННЫХ
// ==========================================
let db = { users: {}, scheduledTask: null };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE));
        } catch (e) {
            db = { users: {}, scheduledTask: null };
        }
    }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
loadDB();

// ==========================================
// ПЕРЕВОДЫ (RU / UZ)
// ==========================================
const LANG = {
    RU: {
        welcome: "👋 Добро пожаловать в **MortisPay**, {name}!",
        m_my: "📊 Мои цели", m_add: "➕ Новая цель", m_top: "💰 Пополнить",
        m_del: "🗑 Удалить", m_stat: "📊 Статистика", m_hist: "📜 История",
        m_plan: "📈 План", m_rem: "🔔 Настройка уведомлений", m_lang: "🌐 Язык",
        no_g: "❌ У вас пока нет созданных целей.",
        ent_n: "🏷 Введите название цели:",
        ent_s: "💵 Какую сумму нужно собрать? (Только число):",
        ent_v: "💎 Выберите валюту:",
        ent_a: "💳 Какую сумму внести?",
        created: "✅ Цель успешно создана!",
        added: "💰 Пополнено!",
        deleted: "🗑 Цель удалена.",
        rem_set: "🔔 Выберите частоту (в 8:00 утра):",
        rem_on: "✅ Настроено!",
        rem_off: "🔕 Выключено.",
        rem_d: "Каждый день", rem_w: "Раз в неделю", rem_m: "Раз в месяц", rem_s: "Выключить",
        sel_g: "🔢 Выберите номер цели:",
        goal_done: "🎉 Поздравляем! Цель достигнута! 🏆",
        err_num: "⚠️ Ошибка! Введите только число (цифры).",
        cron_msg: "☀️ Доброе утро! Не забудьте пополнить свою цель в MortisPay! 💸",
        admin_rem: "📣 Напоминание: Пожалуйста, пополните свои цели сегодня! 🚀",
        stat_msg: "📊 **Статистика:**\nЦелей: {count}\nСобрано: {total}",
        plan_msg: "📈 **План (1000 USD):**\n• 30 дней: 33.3$ / день\n• 60 дней: 16.6$ / день\n• 90 дней: 11.1$ / день",
        hist_empty: "📜 История пуста.",
        hist_title: "📜 **Последние операции:**",
        // Админка на RU
        adm_main: "💎 **Админ-панель:**\n/users - Список юзеров\n/remindall - Быстрое напоминание\n/broadcast - Срочная рассылка\n/schedule - Запланировать пост",
        adm_sch_t: "Напишите время для рассылки в формате ЧЧ:ММ (например 15:30):",
        adm_sch_m: "Теперь напишите текст сообщения:"
    },
    UZ: {
        welcome: "👋 **MortisPay**-ga xush kelibsiz, {name}!",
        m_my: "📊 Maqsadlarim", m_add: "➕ Yangi maqsad", m_top: "💰 To'ldirish",
        m_del: "🗑 O'chirish", m_stat: "📊 Statistika", m_hist: "📜 Tarix",
        m_plan: "📈 Reja", m_rem: "🔔 Bildirishnomalar", m_lang: "🌐 Til",
        no_g: "❌ Sizda hozircha maqsadlar yo'q.",
        ent_n: "🏷 Maqsad nomini kiriting:",
        ent_s: "💵 Qancha yig'ish kerak? (Faqat raqam):",
        ent_v: "💎 Valyutani tanlang:",
        ent_a: "💳 Qancha summa qo'shmoqchisiz?",
        created: "✅ Maqsad yaratildi!",
        added: "💰 To'ldirildi!",
        deleted: "🗑 Maqsad o'chirildi.",
        rem_set: "🔔 Bildirishnoma vaqtini tanlang (soat 8:00 da):",
        rem_on: "✅ Sozlandi!",
        rem_off: "🔕 O'chirildi.",
        rem_d: "Har kuni", rem_w: "Haftada bir", rem_m: "Oyda bir", rem_s: "O'chirish",
        sel_g: "🔢 Maqsad raqamini tanlang:",
        goal_done: "🎉 TABRIKLAYMIZ! Maqsadga erishildi! 🏆",
        err_num: "⚠️ Xato! Faqat raqam kiriting.",
        cron_msg: "☀️ Xayrli tong! Bugun maqsadingizni to'ldirishni unutmang! 💸",
        admin_rem: "📣 E'lon: Iltimos, bugun maqsadlaringizni to'ldirishni unutmang! 🚀",
        stat_msg: "📊 **Statistika:**\nMaqsadlar: {count}\nYig'ildi: {total}",
        plan_msg: "📈 **Reja (1000 USD):**\n• 30 kun: 33.3$ / kun\n• 60 kun: 16.6$ / kun\n• 90 kun: 11.1$ / kun",
        hist_empty: "📜 Tarix bo'sh.",
        hist_title: "📜 **Oxirgi operatsiyalar:**",
        // Админка на UZ
        adm_main: "💎 **Admin paneli:**\n/users - Foydalanuvchilar\n/remindall - Tezkor eslatma\n/broadcast - Xabar yuborish\n/schedule - Xabarni rejalashtirish",
        adm_sch_t: "Xabar vaqtini kiriting HH:MM (masalan 15:30):",
        adm_sch_m: "Endi xabar matnini yozing:"
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
// КРОН-ЗАДАЧИ (8:00 И ПЛАНИРОВЩИК)
// ==========================================
cron.schedule("0 8 * * *", () => {
    const today = new Date();
    Object.values(db.users).forEach(u => {
        if (!u.rem_type || u.rem_type === "off") return;
        let s = false;
        if (u.rem_type === "daily") s = true;
        if (u.rem_type === "weekly" && today.getDay() === 1) s = true;
        if (u.rem_type === "monthly" && today.getDate() === 1) s = true;
        if (s) bot.sendMessage(u.id, LANG[u.lang].cron_msg).catch(() => {});
    });
});

// Проверка запланированных постов админа каждую минуту
cron.schedule("* * * * *", () => {
    if (!db.scheduledTask) return;
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (db.scheduledTask.time === curTime) {
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, "🔔 **NOTIFICATIONS:**\n\n" + db.scheduledTask.text, { parse_mode: "Markdown" }).catch(() => {});
        });
        db.scheduledTask = null; // Очищаем после отправки
        saveDB();
    }
});

// ==========================================
// ОСНОВНОЙ ОБРАБОТЧИК
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

    // --- АДМИН-ЛОГИКА ---
    if (id.toString() === MY_ID) {
        if (text === "/admin") return bot.sendMessage(id, l.adm_main);
        
        if (text === "/schedule") {
            u.state = "ADM_SCH_TIME"; saveDB();
            return bot.sendMessage(id, l.adm_sch_t);
        }
        
        if (u.state === "ADM_SCH_TIME") {
            u.temp_sch_time = text; u.state = "ADM_SCH_TEXT"; saveDB();
            return bot.sendMessage(id, l.adm_sch_m);
        }
        
        if (u.state === "ADM_SCH_TEXT") {
            db.scheduledTask = { time: u.temp_sch_time, text: text };
            u.state = "IDLE"; saveDB();
            return bot.sendMessage(id, `✅ Запланировано на ${db.scheduledTask.time}`);
        }
    }

    // --- ОБРАБОТКА ВВОДА ---
    if (u.state === "AWAIT_NAME") {
        u.tmp_n = text; u.state = "AWAIT_SUM"; saveDB();
        return bot.sendMessage(id, l.ent_s);
    }
    if (u.state === "AWAIT_SUM") {
        const s = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(s) || s <= 0) return bot.sendMessage(id, l.err_num);
        u.tmp_s = s; u.state = "AWAIT_CURR"; saveDB();
        return bot.sendMessage(id, l.ent_v, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], resize_keyboard: true } });
    }
    if (u.state === "AWAIT_CURR") {
        u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, cur: text });
        u.state = "IDLE"; saveDB();
        return bot.sendMessage(id, l.created, getMenu(id));
    }
    if (u.state === "TOP_ID") {
        const idx = parseInt(text) - 1;
        if (!u.goals[idx]) return bot.sendMessage(id, l.err_num);
        u.tmp_idx = idx; u.state = "TOP_VAL"; saveDB();
        return bot.sendMessage(id, l.ent_a);
    }
    if (u.state === "TOP_VAL") {
        const v = parseFloat(text.replace(/\s/g, ''));
        if (isNaN(v) || v <= 0) return bot.sendMessage(id, l.err_num);
        const g = u.goals[u.tmp_idx];
        g.collected += v;
        u.history.push(`+${v} ${g.cur} -> ${g.title} (${new Date().toLocaleDateString()})`);
        u.state = "IDLE"; saveDB();
        bot.sendMessage(id, l.added, getMenu(id));
        if (g.collected >= g.goal) bot.sendMessage(id, l.goal_done);
        return;
    }

    // --- КНОПКИ ---
    switch (text) {
        case l.m_my:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let res = `🎯 **${l.m_my}:**\n`;
            u.goals.forEach((g, i) => {
                let p = Math.min(Math.floor((g.collected / g.goal) * 100), 100);
                let bar = "█".repeat(Math.floor(p / 10)) + "░".repeat(10 - Math.floor(p / 10));
                res += `\n${i + 1}. **${g.title}**\n💰 ${g.collected} / ${g.goal} ${g.cur}\n${bar} ${p}%\n`;
            });
            bot.sendMessage(id, res, { parse_mode: "Markdown" });
            break;

        case l.m_add: u.state = "AWAIT_NAME"; saveDB(); bot.sendMessage(id, l.ent_n); break;

        case l.m_top:
            if (!u.goals.length) return bot.sendMessage(id, l.no_g);
            let tList = `${l.sel_g}\n\n`;
            u.goals.forEach((g, i) => tList += `${i + 1}. ${g.title}\n`);
            u.state = "TOP_ID"; saveDB(); bot.sendMessage(id, tList);
            break;

        case l.m_stat:
            let total = u.goals.reduce((s, g) => s + g.collected, 0);
            bot.sendMessage(id, l.stat_msg.replace("{count}", u.goals.length).replace("{total}", total), { parse_mode: "Markdown" });
            break;

        case l.m_plan: bot.sendMessage(id, l.plan_msg, { parse_mode: "Markdown" }); break;

        case l.m_hist:
            let h = u.history.length ? `${l.hist_title}\n\n${u.history.slice(-10).join("\n")}` : l.hist_empty;
            bot.sendMessage(id, h, { parse_mode: "Markdown" });
            break;

        case l.m_lang:
            u.lang = u.lang === "RU" ? "UZ" : "RU"; saveDB();
            bot.sendMessage(id, u.lang === "RU" ? "🇷🇺 Язык: RU" : "🇺🇿 Til: UZ", getMenu(id));
            break;

        case l.m_rem:
            bot.sendMessage(id, l.rem_set, {
                reply_markup: { keyboard: [[l.rem_d], [l.rem_w, l.rem_m], [l.rem_s]], resize_keyboard: true }
            });
            break;
            
        case l.rem_d: u.rem_type = "daily"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_w: u.rem_type = "weekly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_m: u.rem_type = "monthly"; saveDB(); bot.sendMessage(id, l.rem_on, getMenu(id)); break;
        case l.rem_s: u.rem_type = "off"; saveDB(); bot.sendMessage(id, l.rem_off, getMenu(id)); break;
    }
});

// Доп. команды админа
bot.onText(/\/users/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    let s = "👤 **Users:**\n";
    Object.values(db.users).forEach(usr => s += `• ${usr.name} (ID: ${usr.id})\n`);
    bot.sendMessage(MY_ID, s, { parse_mode: "Markdown" });
});

bot.onText(/\/remindall/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    Object.values(db.users).forEach(usr => bot.sendMessage(usr.id, LANG[usr.lang].admin_rem).catch(() => {}));
    bot.sendMessage(MY_ID, "✅ Sent.");
});

bot.onText(/\/broadcast/, (m) => {
    if (m.from.id.toString() !== MY_ID) return;
    bot.sendMessage(MY_ID, "Текст рассылки:");
    bot.once("message", (msg) => {
        Object.values(db.users).forEach(u => bot.sendMessage(u.id, "📢 **NEWS:**\n\n" + msg.text, { parse_mode: "Markdown" }).catch(() => {}));
        bot.sendMessage(MY_ID, "✅ Done.");
    });
});

console.log("===============================");
console.log("MortisPay ULTIMATE 2026 Active");
console.log("===============================");