const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ===== ВСТАВЬ СВОИ ДАННЫЕ =====
const TOKEN = "8748413994:AAFfy4rZiqpneq2YvQM4Pdj8k5yMfd9D_SY";
const MY_ID = "6736116111";
// ==============================

const bot = new TelegramBot(TOKEN, { polling: true });

// ===== SERVER (для Render) =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("MortisPay Bot работает 🚀"));
app.listen(PORT, () => console.log("Server started"));
// ================================

// ===== БАЗА =====
let db = { users: {} };

if (fs.existsSync("users.json")) {
  db = JSON.parse(fs.readFileSync("users.json"));
}

function saveDB() {
  fs.writeFileSync("users.json", JSON.stringify(db, null, 2));
}
// =================

// ===== ЯЗЫКИ =====
const LANG = {
RU:{
start:"👋 Привет {name}",
goals:"🎯 Ваши цели:\n",
nog:"У вас нет целей",
add:"➕ Новая цель",
my:"📊 Мои цели",
topup:"💰 Пополнить",
del:"🗑 Удалить",
lang:"🌐 Язык",
plan:"📈 План",
stat:"📊 Статистика",
hist:"📜 История",
rem:"🔔 Напоминания",
done:"Цель достигнута 🎉",
enterName:"Введите название цели",
enterSum:"Введите сумму",
added:"Пополнено",
deleted:"Удалено",
created:"Цель создана"
},

UZ:{
start:"👋 Salom {name}",
goals:"🎯 Maqsadlar:\n",
nog:"Maqsad yo'q",
add:"➕ Yangi maqsad",
my:"📊 Maqsadlarim",
topup:"💰 To'ldirish",
del:"🗑 O'chirish",
lang:"🌐 Til",
plan:"📈 Reja",
stat:"📊 Statistika",
hist:"📜 Tarix",
rem:"🔔 Eslatma",
done:"Maqsad bajarildi 🎉",
enterName:"Maqsad nomi",
enterSum:"Summani kiriting",
added:"Qo'shildi",
deleted:"O'chirildi",
created:"Maqsad yaratildi"
},

EN:{
start:"👋 Hello {name}",
goals:"🎯 Goals:\n",
nog:"No goals",
add:"➕ New Goal",
my:"📊 My Goals",
topup:"💰 Top up",
del:"🗑 Delete",
lang:"🌐 Language",
plan:"📈 Plan",
stat:"📊 Stats",
hist:"📜 History",
rem:"🔔 Reminder",
done:"Goal completed 🎉",
enterName:"Goal name",
enterSum:"Enter amount",
added:"Added",
deleted:"Deleted",
created:"Goal created"
}
};
// =================

// ===== MENU =====
function menu(id){
const l = LANG[db.users[id].lang];
return{
reply_markup:{
keyboard:[
[l.my],
[l.add,l.topup],
[l.del,l.stat],
[l.hist,l.plan],
[l.rem,l.lang]
],
resize_keyboard:true
}
}
}
// =================

// ===== USER CREATE =====
function createUser(msg){
const id=msg.from.id;

if(!db.users[id]){
db.users[id]={
id:id,
name:msg.from.first_name,
username:msg.from.username||"none",
lang:"RU",
goals:[],
history:[],
reminder:true
};

saveDB();

bot.sendMessage(MY_ID,
`👤 Новый пользователь
${msg.from.first_name}
@${msg.from.username}`
);
}
}
// =======================

// ===== START =====
bot.onText(/\/start/,msg=>{
const id=msg.from.id;

createUser(msg);

const l=LANG[db.users[id].lang];

bot.sendMessage(
id,
l.start.replace("{name}",msg.from.first_name),
menu(id)
);
});
// ==================

// ===== МОИ ЦЕЛИ =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];
const text=msg.text;

if(text===l.my){

const goals=db.users[id].goals;

if(goals.length===0){
bot.sendMessage(id,l.nog);
return;
}

let res=l.goals;

goals.forEach((g,i)=>{

let p=Math.floor((g.collected/g.goal)*100);
if(p>100)p=100;

let bar="█".repeat(p/10)+"░".repeat(10-(p/10));

res+=`
${i+1}. ${g.title}
${g.collected}/${g.goal} ${g.cur}
${bar} ${p}%
`;
});

bot.sendMessage(id,res);
}
});
// ======================

// ===== НОВАЯ ЦЕЛЬ =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.add){

bot.sendMessage(id,l.enterName);

bot.once("message",m1=>{

const title=m1.text;

bot.sendMessage(id,l.enterSum);

bot.once("message",m2=>{

const sum=Number(m2.text);

if(isNaN(sum)){
bot.sendMessage(id,"Error");
return;
}

db.users[id].goals.push({
title:title,
goal:sum,
collected:0,
cur:"USD"
});

saveDB();

bot.sendMessage(id,l.created,menu(id));

});
});
}
});
// ======================

// ===== ПОПОЛНЕНИЕ =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.topup){

const goals=db.users[id].goals;

if(goals.length===0){
bot.sendMessage(id,l.nog);
return;
}

let list="№:\n";

goals.forEach((g,i)=>{
list+=`${i+1}. ${g.title}\n`;
});

bot.sendMessage(id,list);

bot.once("message",m=>{

let idx=Number(m.text)-1;

if(!goals[idx])return;

bot.sendMessage(id,l.enterSum);

bot.once("message",m2=>{

let val=Number(m2.text);

goals[idx].collected+=val;

db.users[id].history.push(`+${val} ${goals[idx].cur}`);

if(goals[idx].collected>=goals[idx].goal){
bot.sendMessage(id,l.done);
}

saveDB();

bot.sendMessage(id,l.added,menu(id));

});
});
}
});
// ======================

// ===== ИСТОРИЯ =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.hist){

let h=db.users[id].history;

if(!h.length){
bot.sendMessage(id,"Empty");
return;
}

bot.sendMessage(id,h.join("\n"));
}
});
// ===================

// ===== СТАТИСТИКА =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.stat){

let goals=db.users[id].goals.length;

let sum=0;

db.users[id].goals.forEach(g=>{
sum+=g.collected;
});

bot.sendMessage(id,
`📊
Goals: ${goals}
Saved: ${sum}`
);
}
});
// ======================

// ===== ПЛАН =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.plan){

bot.sendMessage(id,
`1000$ goal

30 days → 33/day
60 days → 16/day
90 days → 11/day`
);
}
});
// =================

// ===== ЯЗЫК =====
bot.on("message",msg=>{
const id=msg.from.id;
if(!db.users[id])return;

const l=LANG[db.users[id].lang];

if(msg.text===l.lang){

const arr=["RU","UZ","EN"];

let i=arr.indexOf(db.users[id].lang);

db.users[id].lang=arr[(i+1)%3];

saveDB();

bot.sendMessage(id,"Language changed",menu(id));
}
});
// =================

// ===== ADMIN =====
bot.onText(/\/admin/,msg=>{

if(msg.from.id!=MY_ID)return;

const users=Object.keys(db.users).length;

bot.sendMessage(MY_ID,
`ADMIN PANEL

Users: ${users}`
);

});

// ===== USERS =====
bot.onText(/\/users/,msg=>{

if(msg.from.id!=MY_ID)return;

let list="Users:\n";

Object.values(db.users).forEach(u=>{
list+=`${u.name} @${u.username}\n`;
});

bot.sendMessage(MY_ID,list);

});

// ===== BROADCAST =====
bot.onText(/\/broadcast/,msg=>{

if(msg.from.id!=MY_ID)return;

bot.sendMessage(MY_ID,"Send message");

bot.once("message",m=>{

Object.values(db.users).forEach(u=>{
bot.sendMessage(u.id,m.text);
});

});

});

console.log("MortisPay запущен 🚀");