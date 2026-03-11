const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// CONFIGURATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111"; // Твой ID как владельца
const DB_FILE = "users.json";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Server for Render
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("MortisPay Engine Status: Online 🚀"));
app.listen(PORT, () => console.log(`[SYSTEM] Server listening on port ${PORT}`));

// ==========================================
// DATABASE ENGINE
// ==========================================
let db = { users: {} };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE);
            db = JSON.parse(data);
            console.log("[DB] Data loaded successfully");
        } catch (e) {
            console.log("[DB] Error loading data, reset to empty");
            db = { users: {} };
        }
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

loadDB();

// ==========================================
// LOCALIZATION (RU, UZ, EN)
// ==========================================
const LANG = {
    RU: {
        welcome: "👋 Добро пожаловать в **MortisPay**, {name}!",
        menu_my: "📊 Мои цели", menu_add: "➕ Новая цель",
        menu_topup: "💰 Пополнить", menu_del: "🗑 Удалить",
        menu_stat: "📊 Статистика", menu_hist: "📜 История",
        menu_plan: "📈 План", menu_rem: "🔔 Напоминания", menu_lang: "🌐 Язык",
        no_goals: "📭 У вас пока нет созданных целей.",
        enter_name: "🏷 Введите название вашей цели (например: Новый телефон):",
        enter_sum: "💵 Какую сумму нужно собрать? (Введите только число):",
        enter_amount: "💳 Какую сумму вы хотите внести сейчас?",
        goal_created: "✅ Цель успешно создана! Удачи в накоплении!",
        added: "💰 Баланс цели успешно пополнен!",
        deleted: "🗑 Цель была удалена.",
        rem_on: "🔔 Напоминания: **ВКЛЮЧЕНЫ**\nЯ буду писать вам каждый вечер.",
        rem_off: "🔕 Напоминания: **ВЫКЛЮЧЕНЫ**",
        select_goal: "🔢 Выберите номер цели из списка выше:",
        goal_reached: "🎉 ПОЗДРАВЛЯЕМ! Вы достигли своей цели! 🏆",
        invalid_input: "⚠️ Ошибка: Пожалуйста, введите корректное число.",
        cron_msg: "🔔 Арслан, время проверить свои финансы! Не забудь пополнить копилку в MortisPay. 😉"
    },
    UZ: {
        welcome: "👋 Xush kelibsiz **MortisPay**, {name}!",
        menu_my: "📊 Maqsadlarim", menu_add: "➕ Yangi maqsad",
        menu_topup: "💰 To'ldirish", menu_del: "🗑 O'chirish",
        menu_stat: "📊 Statistika", menu_hist: "📜 Tarix",
        menu_plan: "📈 Reja", menu_rem: "🔔 Eslatma", menu_lang: "🌐 Til",
        no_goals: "📭 Sizda hozircha maqsadlar yo'q.",
        enter_name: "🏷 Maqsadingiz nomini kiriting:",
        enter_sum: "💵 Qancha mablag' yig'ish kerak? (Faqat raqam kiriting):",
        enter_amount: "💳 Qancha qo'shmoqchisiz?",
        goal_created: "✅ Maqsad yaratildi! Omad!",
        added: "💰 Maqsad balansi to'ldirildi!",
        deleted: "🗑 Maqsad o'chirib tashlandi.",
        rem_on: "🔔 Eslatmalar: **YONIK**",
        rem_off: "🔕 Eslatmalar: **O'CHIK**",
        select_goal: "🔢 Ro'yxatdan maqsad raqamini tanlang:",
        goal_reached: "🎉 TABRIKLAYMIZ! Siz maqsadingizga erishdingiz! 🏆",
        invalid_input: "⚠️ Xato: Iltimos raqam kiriting.",
        cron_msg: "🔔 Moliyaviy maqsadlaringizni tekshirish vaqti keldi! MortisPay-ni unutmang."
    },
    EN: {
        welcome: "👋 Welcome to **MortisPay**, {name}!",
        menu_my: "📊 My Goals", menu_add: "➕ New Goal",
        menu_topup: "💰 Top up", menu_del: "🗑 Delete",
        menu_stat: "📊 Stats", menu_hist: "📜 History",
        menu_plan: "📈 Plan", menu_rem: "🔔 Reminder", menu_lang: "🌐 Language",
        no_goals: "📭 You don't have any goals yet.",
        enter_name: "🏷 Enter goal name:",
        enter_sum: "💵 Target amount? (Numbers only):",
        enter_amount: "💳 How much to add?",
        goal_created: "✅ Goal created successfully!",
        added: "💰 Added successfully!",
        deleted: "🗑 Goal deleted.",
        rem_on: "🔔 Reminders: **ON**",
        rem_off: "🔕 Reminders: **OFF**",
        select_goal: "🔢 Choose goal number from list:",
        goal_reached: "🎉 CONGRATS! Goal achieved! 🏆",
        invalid_input: "⚠️ Error: Please enter a valid number.",
        cron_msg: "🔔 Time to check your goals! Don't forget to save today."
    }
};

// ==========================================
// CORE FUNCTIONS
// ==========================================

function getMenu(id) {
    const user = db.users[id];
    const l = LANG[user.lang || "RU"];
    return {
        reply_markup: {
            keyboard: [
                [l.menu_my],
                [l.menu_add, l.menu_topup],
                [l.menu_del, l.menu_stat],
                [l.menu_hist, l.menu_plan],
                [l.menu_rem, l.menu_lang]
            ],
            resize_keyboard: true
        }
    };
}

// ==========================================
// MESSAGE HANDLER
// ==========================================

bot.on("message", (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text) return;

    // Авто-регистрация
    if (!db.users[id]) {
        db.users[id] = {
            id: id,
            name: msg.from.first_name,
            username: msg.from.username || "none",
            lang: "RU",
            goals: [],
            history: [],
            reminder: true,
            state: "IDLE"
        };
        saveDB();
        bot.sendMessage(MY_ID, `🚀 [NEW USER] ${msg.from.first_name} (@${msg.from.username}) joined MortisPay.`);
    }

    const user = db.users[id];
    const l = LANG[user.lang];

    // Global Commands
    if (text === "/start") {
        user.state = "IDLE";
        saveDB();
        return bot.sendMessage(id, l.welcome.replace("{name}", user.name), { parse_mode: "Markdown", ...getMenu(id) });
    }

    if (text === "/admin" && id.toString() === MY_ID) {
        return bot.sendMessage(id, `💎 **MortisPay Admin Panel**\n\n👥 Total Users: ${Object.keys(db.users).length}\n📜 Commands:\n/users - List all users\n/broadcast - Message to all`, { parse_mode: "Markdown" });
    }

    // STATE MACHINE (Обработка ввода данных)
    if (user.state === "AWAITING_GOAL_NAME") {
        user.temp_goal_name = text;
        user.state = "AWAITING_GOAL_SUM";
        saveDB();
        return bot.sendMessage(id, l.enter_sum);
    }

    if (user.state === "AWAITING_GOAL_SUM") {
        const sum = parseFloat(text);
        if (isNaN(sum) || sum <= 0) return bot.sendMessage(id, l.invalid_input);
        user.goals.push({ title: user.temp_goal_name, goal: sum, collected: 0 });
        user.state = "IDLE";
        saveDB();
        return bot.sendMessage(id, l.goal_created, getMenu(id));
    }

    if (user.state === "AWAITING_TOPUP_ID") {
        const idx = parseInt(text) - 1;
        if (!user.goals[idx]) return bot.sendMessage(id, l.invalid_input);
        user.temp_topup_idx = idx;
        user.state = "AWAITING_TOPUP_SUM";
        saveDB();
        return bot.sendMessage(id, l.enter_amount);
    }

    if (user.state === "AWAITING_TOPUP_SUM") {
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0) return bot.sendMessage(id, l.invalid_input);
        const goal = user.goals[user.temp_topup_idx];
        goal.collected += val;
        user.history.push(`+${val} USD -> ${goal.title} (${new Date().toLocaleDateString()})`);
        user.state = "IDLE";
        saveDB();
        bot.sendMessage(id, l.added, getMenu(id));
        if (goal.collected >= goal.goal) bot.sendMessage(id, l.goal_reached);
        return;
    }

    if (user.state === "AWAITING_DEL_ID") {
        const idx = parseInt(text) - 1;
        if (!user.goals[idx]) return bot.sendMessage(id, l.invalid_input);
        user.goals.splice(idx, 1);
        user.state = "IDLE";
        saveDB();
        return bot.sendMessage(id, l.deleted, getMenu(id));
    }

    // BUTTON COMMANDS
    switch (text) {
        case l.menu_my:
            if (user.goals.length === 0) return bot.sendMessage(id, l.no_goals);
            let goalList = `🎯 **${l.menu_my}:**\n`;
            user.goals.forEach((g, i) => {
                let percent = Math.floor((g.collected / g.goal) * 100);
                if (percent > 100) percent = 100;
                let filled = Math.floor(percent / 10);
                let bar = "█".repeat(filled) + "░".repeat(10 - filled);
                goalList += `\n${i + 1}. **${g.title}**\n💰 ${g.collected} / ${g.goal} USD\n${bar} ${percent}%\n`;
            });
            bot.sendMessage(id, goalList, { parse_mode: "Markdown" });
            break;

        case l.menu_add:
            user.state = "AWAITING_GOAL_NAME";
            saveDB();
            bot.sendMessage(id, l.enter_name);
            break;

        case l.menu_topup:
            if (user.goals.length === 0) return bot.sendMessage(id, l.no_goals);
            let tList = `${l.select_goal}\n\n`;
            user.goals.forEach((g, i) => tList += `${i + 1}. ${g.title}\n`);
            user.state = "AWAITING_TOPUP_ID";
            saveDB();
            bot.sendMessage(id, tList);
            break;

        case l.menu_del:
            if (user.goals.length === 0) return bot.sendMessage(id, l.no_goals);
            let dList = `${l.select_goal}\n\n`;
            user.goals.forEach((g, i) => dList += `${i + 1}. ${g.title}\n`);
            user.state = "AWAITING_DEL_ID";
            saveDB();
            bot.sendMessage(id, dList);
            break;

        case l.menu_rem:
            user.reminder = !user.reminder;
            saveDB();
            bot.sendMessage(id, user.reminder ? l.rem_on : l.rem_off, { parse_mode: "Markdown" });
            break;

        case l.menu_lang:
            const nextMap = { "RU": "UZ", "UZ": "EN", "EN": "RU" };
            user.lang = nextMap[user.lang] || "RU";
            saveDB();
            bot.sendMessage(id, `🌐 Language: ${user.lang}`, getMenu(id));
            break;

        case l.menu_stat:
            let totalSaved = user.goals.reduce((sum, g) => sum + g.collected, 0);
            bot.sendMessage(id, `📊 **MortisPay Stats**\n\nTotal Goals: ${user.goals.length}\nTotal Saved: ${totalSaved} USD`, { parse_mode: "Markdown" });
            break;

        case l.menu_hist:
            if (user.history.length === 0) return bot.sendMessage(id, "История пуста");
            bot.sendMessage(id, `📜 **Last Operations:**\n\n${user.history.slice(-10).join("\n")}`, { parse_mode: "Markdown" });
            break;

        case l.menu_plan:
            bot.sendMessage(id, "📈 **Financial Plan (1000 USD Goal):**\n\n• 30 days: 33.3$ / day\n• 60 days: 16.6$ / day\n• 90 days: 11.1$ / day", { parse_mode: "Markdown" });
            break;
    }
});

// ==========================================
// ADMIN EXTENDED COMMANDS
// ==========================================

bot.onText(/\/users/, (msg) => {
    if (msg.from.id.toString() !== MY_ID) return;
    let list = "👤 **User List:**\n";
    Object.values(db.users).forEach(u => list += `• ${u.name} (@${u.username})\n`);
    bot.sendMessage(MY_ID, list, { parse_mode: "Markdown" });
});

bot.onText(/\/broadcast/, (msg) => {
    if (msg.from.id.toString() !== MY_ID) return;
    bot.sendMessage(MY_ID, "📢 Enter message to broadcast to ALL users:");
    bot.once("message", (m) => {
        let count = 0;
        Object.values(db.users).forEach(u => {
            bot.sendMessage(u.id, m.text).catch(() => {});
            count++;
        });
        bot.sendMessage(MY_ID, `✅ Broadcast sent to ${count} users.`);
    });
});

// ==========================================
// CRON SCHEDULER (Every day at 20:00)
// ==========================================
cron.schedule("0 20 * * *", () => {
    Object.values(db.users).forEach(u => {
        if (u.reminder) {
            bot.sendMessage(u.id, LANG[u.lang].cron_msg).catch(() => {});
        }
    });
    console.log("[CRON] Daily reminders sent.");
});

console.log("===============================");
console.log("MortisPay PRO System Started!");
console.log("Status: Stable");
console.log("===============================");