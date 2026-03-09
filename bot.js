const http = require('http');
http.createServer((req, res) => res.end('Bot is running!')).listen(process.env.PORT || 3000);
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ================= НАСТРОЙКИ =================
const TOKEN = '8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY'; 
const MY_ID = '6736116111'; 
// =============================================

const bot = new TelegramBot(TOKEN, { polling: true });

let db = { users: {} };
if (fs.existsSync('users.json')) {
    try {
        db = JSON.parse(fs.readFileSync('users.json'));
    } catch (e) {
        db = { users: {} };
    }
}

function saveDB() {
    fs.writeFileSync('users.json', JSON.stringify(db, null, 2));
}

const LANGS = {
    RU: {
        start: "Привет, {name}! 👋",
        noGoals: "У вас нет целей.",
        goalsList: "🎯 Ваши цели:\n\n",
        enterGoalName: "Назовите цель:",
        enterGoalSum: "Сумма цели:",
        selectCur: "Выберите валюту:",
        goalCreated: "Цель создана! ✅",
        errorNumber: "Ошибка! Введите число.",
        selectGoal: "Выберите номер цели:",
        goalAdded: "Пополнено! ✅",
        goalDeleted: "Удалено! 🗑",
        languageSet: "Язык: RU",
        remains: "Осталось накопить: ",
        btns: ["📊 Мои цели", "➕ Новая цель", "➕ Пополнить", "🗑 Удалить цель", "🌐 Язык"]
    },
    UZ: {
        start: "Salom, {name}! 👋",
        noGoals: "Maqsadlar yo'q.",
        goalsList: "🎯 Maqsadlar:\n\n",
        enterGoalName: "Nomini kiriting:",
        enterGoalSum: "Summani kiriting:",
        selectCur: "Valyutani tanlang:",
        goalCreated: "Yaratildi! ✅",
        errorNumber: "Xato! Raqam kiriting.",
        selectGoal: "Raqamni tanlang:",
        goalAdded: "To'ldirildi! ✅",
        goalDeleted: "O'chirildi! 🗑",
        languageSet: "Til: UZ",
        remains: "Yana yig'ish kerak: ",
        btns: ["📊 Maqsadlarim", "➕ Yangi maqsad", "➕ To'ldirish", "🗑 O'chirish", "🌐 Til"]
    },
    EN: {
        start: "Hello, {name}! 👋",
        noGoals: "You have no goals.",
        goalsList: "🎯 Your goals:\n\n",
        enterGoalName: "Goal name:",
        enterGoalSum: "Target amount:",
        selectCur: "Select currency:",
        goalCreated: "Goal created! ✅",
        errorNumber: "Error! Enter a number.",
        selectGoal: "Select goal number:",
        goalAdded: "Added! ✅",
        goalDeleted: "Deleted! 🗑",
        languageSet: "Language: EN",
        remains: "Remaining to save: ",
        btns: ["📊 My Goals", "➕ New Goal", "➕ Top-up", "🗑 Delete Goal", "🌐 Language"]
    }
};

function getMenu(id) {
    const lang = db.users[id].lang || "RU";
    const b = LANGS[lang].btns;
    return { reply_markup: { keyboard: [[b[0]], [b[1], b[2]], [b[3], b[4]]], resize_keyboard: true } };
}

bot.on('message', (msg) => {
    const id = String(msg.from.id);
    const text = msg.text;
    if (!text) return;

    if (!db.users[id]) {
        db.users[id] = { id, name: msg.from.first_name, username: msg.from.username || "n/a", goals: [], lang: "RU" };
        saveDB();
        bot.sendMessage(MY_ID, `🔔 НОВЫЙ ЮЗЕР: ${msg.from.first_name} (@${msg.from.username || 'скрыт'})`);
    }

    const L = LANGS[db.users[id].lang] || LANGS.RU;

    // Админка без рассылки
    if (text === "/admin" && id === MY_ID) {
        const total = Object.keys(db.users).length;
        return bot.sendMessage(id, `📊 *Админ-панель*\n\nВсего юзеров: ${total}\n/users - Список юзеров`, { parse_mode: "Markdown" });
    }

    if (text === "/start") {
        return bot.sendMessage(id, L.start.replace("{name}", db.users[id].name), getMenu(id));
    }

    // Смена языка (RU -> UZ -> EN)
    else if (text === L.btns[4]) {
        const lOrder = ["RU", "UZ", "EN"];
        const nextIdx = (lOrder.indexOf(db.users[id].lang) + 1) % 3;
        db.users[id].lang = lOrder[nextIdx];
        saveDB();
        bot.sendMessage(id, LANGS[db.users[id].lang].languageSet, getMenu(id));
    }

    // Список целей с расчетом остатка
    else if (text === L.btns[0]) {
        const goals = db.users[id].goals;
        if (!goals.length) return bot.sendMessage(id, L.noGoals);
        let res = L.goalsList;
        goals.forEach((g, i) => {
            const left = g.goal - g.collected;
            const remains = left > 0 ? left : 0;
            const progress = Math.min(100, Math.floor((g.collected / g.goal) * 100));
            
            res += `${i + 1}. *${g.title}*\n`;
            res += `💰 ${g.collected} / ${g.goal} ${g.currency} (${progress}%)\n`;
            res += `📉 ${L.remains} *${remains} ${g.currency}*\n\n`;
        });
        bot.sendMessage(id, res, { parse_mode: "Markdown" });
    }

    // Новая цель (добавлен RUB)
    else if (text === L.btns[1]) {
        bot.sendMessage(id, L.enterGoalName).then(() => {
            bot.once('message', (m1) => {
                if (Object.values(LANGS).some(l => l.btns.includes(m1.text))) return;
                const title = m1.text;
                bot.sendMessage(id, L.enterGoalSum).then(() => {
                    bot.once('message', (m2) => {
                        const sum = Number(m2.text);
                        if (isNaN(sum)) return bot.sendMessage(id, L.errorNumber);
                        bot.sendMessage(id, L.selectCur, { reply_markup: { keyboard: [["USD", "RUB", "UZS"]], one_time_keyboard: true, resize_keyboard: true } }).then(() => {
                            bot.once('message', (m3) => {
                                db.users[id].goals.push({ title, goal: sum, collected: 0, currency: m3.text });
                                saveDB();
                                bot.sendMessage(id, L.goalCreated, getMenu(id));
                            });
                        });
                    });
                });
            });
        });
    }

    // Пополнение и удаление (логика как раньше)
    else if (text === L.btns[2]) {
        const goals = db.users[id].goals;
        if (!goals.length) return bot.sendMessage(id, L.noGoals);
        let list = "№:\n"; goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list).then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (goals[idx]) {
                    bot.sendMessage(id, L.enterGoalSum).then(() => {
                        bot.once('message', (m2) => {
                            const val = Number(m2.text);
                            if (!isNaN(val)) {
                                db.users[id].goals[idx].collected += val;
                                saveDB();
                                bot.sendMessage(id, L.goalAdded, getMenu(id));
                            }
                        });
                    });
                }
            });
        });
    }

    else if (text === L.btns[3]) {
        const goals = db.users[id].goals;
        if (!goals.length) return bot.sendMessage(id, L.noGoals);
        let list = "Del №:\n"; goals.forEach((g, i) => list += `${i + 1}. ${g.title}\n`);
        bot.sendMessage(id, list).then(() => {
            bot.once('message', (m) => {
                const idx = Number(m.text) - 1;
                if (goals[idx]) {
                    db.users[id].goals.splice(idx, 1);
                    saveDB();
                    bot.sendMessage(id, L.goalDeleted, getMenu(id));
                }
            });
        });
    }
});

bot.onText(/\/users/, (msg) => {
    if (String(msg.from.id) !== MY_ID) return;
    let list = "👥 Юзеры:\n";
    Object.values(db.users).forEach(u => list += `- ${u.name} (@${u.username})\n`);
    bot.sendMessage(MY_ID, list);
});

console.log("Бот запущен! Ошибок нет.");