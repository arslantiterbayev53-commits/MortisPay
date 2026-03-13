const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const cron = require("node-cron");

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = 6736116111; // Admin ID (Arslan)
const DB_FILE = "mortis_vault.json";

const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get("/", (req, res) => res.send("🏦 MortisPay Engine: Full Active"));
app.listen(process.env.PORT || 3000);

// ==========================================
// 💾 DATABASE & LOCALIZATION
// ==========================================
let db = {
  users: {},
  system: {
    totalUsers: 0,
    cron_hour: 8,
    cron_minute: 0,
    cron_timezone: "Asia/Tashkent"
  }
};

const STRINGS = {
  ru: {
    welcome: "🏦 MORTISPAY | VAULT\n\nДобро пожаловать, {name}. Твой личный сейф готов.",
    m_my: "💰 Мои цели", m_add: "✨ Создать", m_top: "📥 Пополнить",
    m_del: "🗑 Удалить", m_stat: "📊 Статистика", m_hist: "📜 История",
    m_plan: "📈 Финплан", m_rem: "🔔 Уведомления", m_lang: "🌐 Язык",
    no_g: "❌ У тебя пока нет активных целей.",
    ent_n: "🏷 Введи название цели:", ent_s: "💵 Какую сумму собрать?",
    ent_v: "💎 Выбери валюту:", ent_a: "💳 Сколько вносишь?",
    created: "✅ Цель создана!", added: "💰 Пополнено!", deleted: "🗑 Удалено.",
    err_num: "⚠️ Вводи только положительные числа!",
    plan_head: "📈 ФИНАНСОВЫЙ ПЛАН:",
    adm_head: "💎 АДМИН ПАНЕЛЬ",
    adm_users: "👤 Пользователей: {count}",
    adm_online: "⚙️ Система: Online",
    adm_broadcast: "📢 Рассылка",
    adm_cron: "⏰ Настроить уведомления",
    adm_back: "🔙 Назад",
    broadcast_prompt: "📝 Введите сообщение для рассылки:",
    cron_time_prompt: "⏰ Введите время (HH:MM):",
    cron_msg_prompt: "📝 Введите сообщение для ежедневных уведомлений:",
    cron_updated: "✅ Уведомления обновлены!",
    rem_on: "🔔 Уведомления: Вкл",
    rem_off: "🔔 Уведомления: Выкл",
    cron_msg: "☀️ MORTISPAY: Доброе утро! Время пополнить копилку! 💸",
    goal_num: "Номер цели:",
    del_num: "Номер для удаления:",
    empty: "Пусто",
    new_user: "🆕 Новый пользователь:\nИмя: {name}\nUsername: @{username}\nID: {id}"
  },
  en: {
    welcome: "🏦 MORTISPAY | VAULT\n\nWelcome, {name}. Your personal safe is ready.",
    m_my: "💰 My Goals", m_add: "✨ Create", m_top: "📥 Deposit",
    m_del: "🗑 Delete", m_stat: "📊 Statistics", m_hist: "📜 History",
    m_plan: "📈 FinPlan", m_rem: "🔔 Alerts", m_lang: "🌐 Language",
    no_g: "❌ You have no active goals.",
    ent_n: "🏷 Enter goal name:", ent_s: "💵 Target amount?",
    ent_v: "💎 Choose currency:", ent_a: "💳 Deposit amount?",
    created: "✅ Goal created!", added: "💰 Deposited!", deleted: "🗑 Deleted.",
    err_num: "⚠️ Please enter positive numbers only!",
    plan_head: "📈 FINANCIAL PLAN:",
    adm_head: "💎 ADMIN PANEL",
    adm_users: "👤 Users: {count}",
    adm_online: "⚙️ System: Online",
    adm_broadcast: "📢 Broadcast",
    adm_cron: "⏰ Set Notifications",
    adm_back: "🔙 Back",
    broadcast_prompt: "📝 Enter broadcast message:",
    cron_time_prompt: "⏰ Enter time (HH:MM):",
    cron_msg_prompt: "📝 Enter daily notification message:",
    cron_updated: "✅ Notifications updated!",
    rem_on: "🔔 Alerts: On",
    rem_off: "🔔 Alerts: Off",
    cron_msg: "☀️ MORTISPAY: Good morning! Don't forget to save today! 💸",
    goal_num: "Goal number:",
    del_num: "Number to delete:",
    empty: "Empty",
    new_user: "🆕 New User:\nName: {name}\nUsername: @{username}\nID: {id}"
  },
  uz: {
    welcome: "🏦 MORTISPAY | XAZINA\n\nXush kelibsiz, {name}. Sizning shaxsiy xavfsizligingiz tayyor.",
    m_my: "💰 Mening Maqsadlarim", m_add: "✨ Yaratish", m_top: "📥 Depozit",
    m_del: "🗑 O'chirish", m_stat: "📊 Statistika", m_hist: "📜 Tarix",
    m_plan: "📈 Moliyaviy Reja", m_rem: "🔔 Ogohlantirishlar", m_lang: "🌐 Til",
    no_g: "❌ Sizda faol maqsadlar yo'q.",
    ent_n: "🏷 Maqsad nomini kiriting:", ent_s: "💵 Maqsad miqdori?",
    ent_v: "💎 Valyutani tanlang:", ent_a: "💳 Depozit miqdori?",
    created: "✅ Maqsad yaratildi!", added: "💰 Depozit qilindi!", deleted: "🗑 O'chirildi.",
    err_num: "⚠️ Faqat ijobiy raqamlarni kiriting!",
    plan_head: "📈 MOLIYAVIY REJA:",
    adm_head: "💎 ADMIN PANELI",
    adm_users: "👤 Foydalanuvchilar: {count}",
    adm_online: "⚙️ Tizim: Onlayn",
    adm_broadcast: "📢 Xabar Yuborish",
    adm_cron: "⏰ Ogohlantirishlarni Sozlash",
    adm_back: "🔙 Orqaga",
    broadcast_prompt: "📝 Xabar matnini kiriting:",
    cron_time_prompt: "⏰ Vaqtni kiriting (HH:MM):",
    cron_msg_prompt: "📝 Kundalik ogohlantirish xabarini kiriting:",
    cron_updated: "✅ Ogohlantirishlar yangilandi!",
    rem_on: "🔔 Ogohlantirishlar: Yoqilgan",
    rem_off: "🔔 Ogohlantirishlar: O'chirilgan",
    cron_msg: "☀️ MORTISPAY: Hayrli tong! Bugun tejashni unutmang! 💸",
    goal_num: "Maqsad raqami:",
    del_num: "O'chirish uchun raqam:",
    empty: "Bo'sh",
    new_user: "🆕 Yangi Foydalanuvchi:\nIsm: {name}\nUsername: @{username}\nID: {id}"
  }
};

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
      console.error("DB Load Error:", e);
    }
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("DB Save Error:", e);
  }
}

loadDB();

// ==========================================
// 🛠 HELPERS
// ==========================================
function getUserMenu(lang) {
  const s = STRINGS[lang];
  return {
    reply_markup: {
      keyboard: [
        [s.m_my], [s.m_add, s.m_top],
        [s.m_del, s.m_stat], [s.m_hist, s.m_plan],
        [s.m_rem, s.m_lang]
      ],
      resize_keyboard: true
    }
  };
}

function getAdminMenu(lang) {
  const s = STRINGS[lang];
  return {
    reply_markup: {
      keyboard: [
        [s.adm_users, s.adm_broadcast],
        [s.adm_cron, s.adm_back]
      ],
      resize_keyboard: true
    }
  };
}

function getBar(progress) {
  return "🟩".repeat(Math.min(Math.floor(progress / 10), 10)) + "⬜".repeat(10 - Math.min(Math.floor(progress / 10), 10));
}

function getTotals(goals, isGoal = false) {
  const totals = {};
  goals.forEach(g => {
    const key = isGoal ? 'goal' : 'collected';
    totals[g.currency] = (totals[g.currency] || 0) + g[key];
  });
  return totals;
}

function formatTotals(totals) {
  return Object.entries(totals).map(([c, v]) => `${v} ${c}`).join(', ');
}

function initCron() {
  return cron.schedule(
    `${db.system.cron_minute || 0} ${db.system.cron_hour || 8} * * *`,
    () => {
      Object.values(db.users).forEach(user => {
        if (user.reminders) {
          const s = STRINGS[user.lang];
          const msg = db.system.cron_msg || s.cron_msg;
          bot.sendMessage(user.id, msg, { parse_mode: "Markdown" }).catch(() => {});
        }
      });
      // Daily admin report
      const s = STRINGS[db.users[MY_ID]?.lang || 'ru'];
      bot.sendMessage(
        MY_ID,
        `📊 **Daily Admin Report**\n${s.adm_users.replace('{count}', db.system.totalUsers)}`
      ).catch(() => {});
    },
    { timezone: db.system.cron_timezone || "Asia/Tashkent" }
  );
}

let cronTask = initCron();

// ==========================================
// 🚀 MAIN ENGINE
// ==========================================
bot.on("message", (msg) => {
  if (!msg.from || !msg.text) return;

  const id = msg.from.id;
  const text = msg.text.trim();
  const username = msg.from.username || 'none';

  if (!db.users[id]) {
    db.users[id] = {
      id,
      name: msg.from.first_name,
      username,
      goals: [],
      history: [],
      state: "IDLE",
      reminders: true,
      lang: "ru"
    };
    db.system.totalUsers++;
    saveDB();

    // Notify admin about new user
    const sAdmin = STRINGS[db.users[MY_ID]?.lang || 'ru'];
    const newUserMsg = sAdmin.new_user
      .replace('{name}', db.users[id].name)
      .replace('{username}', username)
      .replace('{id}', id);
    bot.sendMessage(MY_ID, newUserMsg);
  }

  const u = db.users[id];
  const s = STRINGS[u.lang];

  // --- 💎 ADMIN COMMANDS ---
  if (id === MY_ID) {
    if (text === "/admin") {
      u.state = "ADMIN";
      saveDB();
      return bot.sendMessage(id, `${s.adm_head}\n\n${s.adm_users.replace('{count}', db.system.totalUsers)}\n${s.adm_online}`, getAdminMenu(u.lang));
    }

    if (u.state === "ADMIN") {
      switch (text) {
        case s.adm_users:
          return bot.sendMessage(id, s.adm_users.replace('{count}', db.system.totalUsers));
        case s.adm_broadcast:
          u.state = "ADMIN_BROADCAST";
          saveDB();
          return bot.sendMessage(id, s.broadcast_prompt);
        case s.adm_cron:
          u.state = "ADMIN_CRON_TIME";
          saveDB();
          return bot.sendMessage(id, s.cron_time_prompt);
        case s.adm_back:
          u.state = "IDLE";
          saveDB();
          return bot.sendMessage(id, "✅ OK", getUserMenu(u.lang));
      }
    } else if (u.state === "ADMIN_BROADCAST") {
      // Send broadcast to all users
      Object.values(db.users).forEach(user => {
        bot.sendMessage(user.id, text, { parse_mode: "Markdown" }).catch(() => {});
      });
      u.state = "ADMIN";
      saveDB();
      return bot.sendMessage(id, "📢 Рассылка отправлена!", getAdminMenu(u.lang));
    } else if (u.state === "ADMIN_CRON_TIME") {
      const [hour, minute] = text.split(':').map(Number);
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return bot.sendMessage(id, "⚠️ Неверный формат времени! (HH:MM)");
      }
      db.system.cron_hour = hour;
      db.system.cron_minute = minute;
      u.state = "ADMIN_CRON_MSG";
      saveDB();
      return bot.sendMessage(id, s.cron_msg_prompt);
    } else if (u.state === "ADMIN_CRON_MSG") {
      db.system.cron_msg = text;
      saveDB();
      cronTask.stop();
      cronTask = initCron();
      u.state = "ADMIN";
      saveDB();
      return bot.sendMessage(id, s.cron_updated, getAdminMenu(u.lang));
    }
  }

  if (text === "/start") {
    u.state = "IDLE";
    saveDB();
    return bot.sendMessage(id, s.welcome.replace("{name}", u.name), { parse_mode: "Markdown", ...getUserMenu(u.lang) });
  }

  // --- 💰 USER LOGIC ---
  if (u.state === "IDLE") {
    switch (text) {
      case s.m_my:
        if (!u.goals.length) return bot.sendMessage(id, s.no_g);
        let gList = `💰 **${s.m_my}:**\n\n`;
        u.goals.forEach((g, i) => {
          const p = g.goal > 0 ? Math.min(Math.floor((g.collected / g.goal) * 100), 100) : 0;
          gList += `${i + 1}. *${g.title}*\n${g.collected}/${g.goal} ${g.currency}\n${getBar(p)} ${p}%\n\n`;
        });
        return bot.sendMessage(id, gList, { parse_mode: "Markdown" });

      case s.m_add:
        u.state = "A_N";
        saveDB();
        return bot.sendMessage(id, s.ent_n);

      case s.m_top:
        if (!u.goals.length) return bot.sendMessage(id, s.no_g);
        u.state = "T_I";
        saveDB();
        return bot.sendMessage(id, s.goal_num);

      case s.m_del:
        if (!u.goals.length) return bot.sendMessage(id, s.no_g);
        u.state = "D_I";
        saveDB();
        return bot.sendMessage(id, s.del_num);

      case s.m_stat:
        const totalsCollected = getTotals(u.goals);
        const totalGoals = u.goals.length;
        return bot.sendMessage(
          id,
          `📊 ${s.m_stat}:\n\nGoals: ${totalGoals}\nTotal Saved: ${Object.keys(totalsCollected).length ? formatTotals(totalsCollected) : '0'}`
        );

      case s.m_hist:
        const hText = u.history.length
          ? `📜 **${s.m_hist}:**\n\n${u.history.slice(-10).join("\n")}`
          : s.empty;
        return bot.sendMessage(id, hText, { parse_mode: "Markdown" });

      case s.m_plan:
        if (!u.goals.length) return bot.sendMessage(id, s.no_g);
        const totalsGoal = getTotals(u.goals, true);
        const totalsCollectedPlan = getTotals(u.goals);
        let planText = `${s.plan_head}\n\n`;
        Object.keys(totalsGoal).forEach(c => {
          const tG = totalsGoal[c];
          const tC = totalsCollectedPlan[c] || 0;
          const totalP = tG > 0 ? Math.min(Math.floor((tC / tG) * 100), 100) : 0;
          planText += `Currency: ${c}\nTarget: ${tG}\nSaved: ${tC}\nLeft: ${tG - tC}\n${getBar(totalP)} ${totalP}%\n\n`;
        });
        return bot.sendMessage(id, planText, { parse_mode: "Markdown" });

      case s.m_rem:
        u.reminders = !u.reminders;
        saveDB();
        return bot.sendMessage(id, u.reminders ? s.rem_on : s.rem_off);

      case s.m_lang:
        u.state = "SET_LANG";
        saveDB();
        return bot.sendMessage(id, "🌍 Language / Til / Язык:", {
          reply_markup: {
            keyboard: [["🇷🇺 Русский", "🇺🇸 English", "🇺🇿 O'zbek"]],
            resize_keyboard: true
          }
        });
    }
  } else if (u.state === "SET_LANG") {
    if (text.includes("Русский")) u.lang = "ru";
    else if (text.includes("English")) u.lang = "en";
    else if (text.includes("O'zbek")) u.lang = "uz";
    u.state = "IDLE";
    saveDB();
    return bot.sendMessage(id, "✅ OK", getUserMenu(u.lang));
  } else if (u.state === "A_N") {
    u.tmp_n = text;
    u.state = "A_S";
    saveDB();
    return bot.sendMessage(id, s.ent_s);
  } else if (u.state === "A_S") {
    const val = parseFloat(text.replace(',', '.'));
    if (isNaN(val) || val <= 0) return bot.sendMessage(id, s.err_num);
    u.tmp_s = val;
    u.state = "A_C";
    saveDB();
    return bot.sendMessage(id, s.ent_v, {
      reply_markup: {
        keyboard: [["USD", "RUB", "UZS"]],
        resize_keyboard: true
      }
    });
  } else if (u.state === "A_C") {
    if (!["USD", "RUB", "UZS"].includes(text)) return bot.sendMessage(id, "⚠️ Invalid currency!");
    u.goals.push({ title: u.tmp_n, goal: u.tmp_s, collected: 0, currency: text });
    u.state = "IDLE";
    saveDB();
    return bot.sendMessage(id, s.created, getUserMenu(u.lang));
  } else if (u.state === "T_I") {
    const idx = parseInt(text) - 1;
    if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, "⚠️ Invalid number!");
    u.tmp_idx = idx;
    u.state = "T_S";
    saveDB();
    return bot.sendMessage(id, s.ent_a);
  } else if (u.state === "T_S") {
    const amt = parseFloat(text.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return bot.sendMessage(id, s.err_num);
    const g = u.goals[u.tmp_idx];
    g.collected += amt;
    u.history.push(`📥 +${amt} ${g.currency} | ${g.title}`);
    u.state = "IDLE";
    saveDB();
    return bot.sendMessage(id, s.added, getUserMenu(u.lang));
  } else if (u.state === "D_I") {
    const idx = parseInt(text) - 1;
    if (isNaN(idx) || !u.goals[idx]) return bot.sendMessage(id, "⚠️ Invalid number!");
    u.goals.splice(idx, 1);
    u.state = "IDLE";
    saveDB();
    return bot.sendMessage(id, s.deleted, getUserMenu(u.lang));
  }
});