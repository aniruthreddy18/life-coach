// =============================================================
// messages.js — THE FUN ONES 😄 (free: no AI, just templates)
// -------------------------------------------------------------
// 1. GREETINGS: a different line every time the app is opened.
//    We count opens per student (profiles.app_opens) and walk
//    through the list, so 10 opens = 10 different messages.
// 2. NOTIFICATIONS: morning, evening, late nudge and the weekly
//    report, rotating by day so they don't repeat.
//
// Each student gets their own language (from onboarding):
//   "English + Telugu" -> te (Tenglish)
//   "English + Hindi"  -> hi (Hinglish)
//   "English"          -> en
// {name}, {first} (first task), {done}, {total}, {grade} are filled in.
// Want more? Just add lines to the lists — no other code changes.
// =============================================================

export const langOf = (language) =>
  /telugu/i.test(language ?? "") ? "te" : /hindi/i.test(language ?? "") ? "hi" : "en";

const GREETINGS = {
  te: [
    "Hii bro, ela unnav? 😄",
    "Pilla em antundhi ra {name}? 👀 Mundu task complete chey, taruvatha cheppu",
    "Arey vachesava {name}! Welcome back boss 🔥",
    "Em ra, tiffin aiyindha? Inka start cheddama? 🍛",
    "Baagunnava master? Ivala oka chinna target pettukundam 🎯",
    "Rey {name}, phone pakkana pettu, pani chuddam 📵",
    "Hero entry ichav 😎 Ippudu tasks ki kuda entry ivvu",
    "Chai thagava? ☕ Ippudu focus mode on chey",
    "Mama, scene enti? Ivala em plan?",
    "Instagram reels tarvatha ra babu, first chaduvu 😅",
    "Bangaram, ivala 2 tasks kottesi pothey chalu 💪",
    "Ninna late ga padukunnava? Kallu chusthe telusthundi 😂",
    "Exam ki inka time undi anukuntunnava? Ledu bro 😅",
    "Nuvvu vachav, nenu ready. Inka late enduku? 🚀",
    "Mahesh Babu laaga silent ga pani kanicheyyi 😎",
    "Em sangathi {name}? Ivala full josh lo unnava? ⚡",
    "Office open ayindi boss 🏢 Pani start cheddam",
    "Rey, consistency ante nuvve ra ippudu 👑 Continue chey",
    "Biryani tarvatha, ippudu brain ki food ivvu 🧠",
    "Lazy ga undaku {name}, legu legu 🏃",
    "Sooper ga vachav! Ivala emi break chesthav? 💥",
    "Settle ayyava? Ok, ippudu one task finish chey 🎯",
    "Bro nee future self thanks cheptadu, nammu 🙌",
    "Ee roju ni day, {name}. Kummeyi 🔥",
  ],
  hi: [
    "Kya haal hai bhai? 😄 Chal shuru karte hain",
    "Aur {name}, kya scene hai aaj ka? 👀",
    "Arre aa gaye boss! Welcome back 🔥",
    "Chai pi li? ☕ Ab focus mode on",
    "Bhai phone side mein rakh, aaj kuch bada karte hain 📵",
    "Hero ki entry ho gayi 😎 Ab tasks ki entry bhi kar de",
    "Reels baad mein bhai, pehle padhai 😅",
    "Raat ko late soya kya? Aankhein bata rahi hain 😂",
    "Kya baat hai, aaj bhi aa gaye! Consistency ka baap 👑",
    "Aaj ka target chhota hai, tu kar lega 💪",
    "Kaun hai ye topper? Oh, tum ho {name} 😄",
    "Tu aaya, ab productivity aayegi 🚀",
    "Exam door hai sochta hai? Nahi hai bhai 😅",
    "Biryani baad mein, abhi dimaag ko khana de 🧠",
    "Chal uth {name}, aalas chhod 🏃",
    "Aaj tera din hai, {name}. Phod de 🔥",
    "Tera future self thank you bolega, pakka 🙌",
  ],
  en: [
    "Look who's here! Ready to crush it, {name}? 💪",
    "Hey {name}! Coffee in hand? Let's go ☕",
    "The legend returns 😎 Your tasks missed you",
    "Phone down, focus up. You've got this 📵",
    "Back again? Consistency looks good on you 👑",
    "Reels can wait. Your future self can't 😅",
    "Late night? Your eyes are snitching 😂",
    "Main character energy today, {name} ⚡",
    "Small target today. Big win tomorrow 🎯",
    "Who's this topper? Oh, it's you 😄",
    "Lazy mode off, {name}. Up and at 'em 🏃",
    "Today's your day. Go get it 🔥",
  ],
};

const MORNING = {
  te: [
    "Good morning {name} ☀️ Smooth start chesava master uu? First: {first}",
    "Rey {name}, nidra chalu 😤 {first} start chey",
    "Kastapadu pani chey, lekapothe MG ayithav bida 😂 Ivala: {first}",
    "Gym ki vellu maya 🏋️ Taruvatha {first} complete chey",
    "Lechava bangaram? Ivala first task: {first} 💪",
    "Coffee thagi {first} kottey ☕🔥",
  ],
  hi: [
    "Good morning {name} ☀️ Smooth start kiya? Pehle: {first}",
    "Uth ja {name}, neend bahut hui 😤 {first} shuru kar",
    "Mehnat kar, warna bas sapne dekhta reh jayega 😂 Aaj: {first}",
    "Gym ja bhai 🏋️ Phir {first} khatam kar",
    "Chai pi aur {first} pe lag ja ☕🔥",
  ],
  en: [
    "Good morning {name} ☀️ Smooth start? First up: {first}",
    "Rise and grind, {name} 😤 Start with: {first}",
    "Work hard now or cry later 😂 Today: {first}",
    "Hit the gym 🏋️ then knock out {first}",
    "Coffee first, then {first} ☕🔥",
  ],
};

const EVENING = {
  te: [
    "Em sangathi {name}, entha varaku chesinav? {done}/{total} done 👀",
    "Rey Kamal Haasan, what's the update? 🎬 Check-in chey",
    "Day ayipoindi boss, report ivvu 📋 ({done}/{total})",
    "Ivala hero na zero na? Check-in lo cheppu 😄",
    "{done}/{total} tasks ra. Story enti? Check-in chey",
  ],
  hi: [
    "Kya scene hai {name}, kitna kiya? {done}/{total} done 👀",
    "Oye Shah Rukh, what's the update? 🎬 Check-in kar",
    "Din khatam, report de boss 📋 ({done}/{total})",
    "Aaj hero ya zero? Check-in mein bata 😄",
  ],
  en: [
    "So {name}, how far did you get? {done}/{total} done 👀",
    "Hey superstar, what's the update? 🎬 Time to check in",
    "Day's over, boss. Report please 📋 ({done}/{total})",
    "Hero or zero today? Tell me in the check-in 😄",
  ],
};

const NUDGE = {
  te: [
    "Inka check-in cheyaledu ra 😑 2 nimishalu chalu",
    "Ignore chesthunnava? Nenu marchipolenu bro 😤 Check-in NOW",
    "Rey {name}, nidrapoyeemundu oka check-in please 🙏",
  ],
  hi: [
    "Abhi tak check-in nahi kiya 😑 Bas 2 minute lagenge",
    "Ignore kar raha hai? Main bhoolta nahi bhai 😤 Check-in NOW",
    "Sone se pehle ek check-in, {name} 🙏",
  ],
  en: [
    "Still no check-in 😑 It takes 2 minutes",
    "Ignoring me? I don't forget, buddy 😤 Check in NOW",
    "One check-in before bed, {name} 🙏",
  ],
};

const REPORT = {
  te: "Weekly report ready ra! Grade {grade} 👀 Chudu",
  hi: "Weekly report ready hai! Grade {grade} 👀 Dekh le",
  en: "Your weekly report is ready. Grade {grade} 👀",
};

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
const dayIndex = () => Math.floor(Date.now() / 86_400_000);

// The n-th time this student opens the app (n starts at 1)
export function greeting(language, n, name) {
  const list = GREETINGS[langOf(language)];
  return fill(list[(n - 1) % list.length], { name });
}

// Rotates by day so the same notification doesn't repeat every day
function pick(lists, language, values) {
  const list = lists[langOf(language)];
  return fill(list[dayIndex() % list.length], values);
}

export const morningNote = (profile, tasks) =>
  pick(MORNING, profile.language, { name: profile.name, first: tasks[0]?.title ?? "open the app for today's plan" });
export const eveningNote = (profile, done, total) => pick(EVENING, profile.language, { name: profile.name, done, total });
export const nudgeNote = (profile) => pick(NUDGE, profile.language, { name: profile.name });
export const reportNote = (profile, grade) => fill(REPORT[langOf(profile.language)], { grade });
