// =============================================================
// questions.js — the onboarding questions (just DATA).
// An array of objects. The frontend fetches this via
// GET /api/onboarding/questions and draws one screen per question.
// Change the wording here and the app updates — no UI code needed.
// =============================================================
export const QUESTIONS = [
  {
    id: "name",
    text: "First things first — what should your coach call you?",
    type: "text",
    placeholder: "Your name",
  },
  {
    id: "about",
    text: "Tell me about yourself. What do you study or do, which year, where?",
    type: "textarea",
    placeholder: "e.g. B.Tech CSE 3rd year at ... , living in hostel",
  },
  {
    id: "goal",
    text: "What's your BIG goal for the next 3–6 months?",
    type: "textarea",
    placeholder: "e.g. Crack a software developer internship / clear GATE / build 3 projects",
  },
  {
    id: "learn",
    text: "What do you want to study or learn? List the subjects or skills.",
    type: "textarea",
    placeholder: "e.g. DSA in Java, React, SQL, communication skills",
  },
  {
    id: "level",
    text: "Honestly — what's your current level in that?",
    type: "choice",
    options: ["Complete beginner", "I know the basics", "Intermediate", "Advanced"],
  },
  {
    id: "interests",
    text: "What are you into outside studies? What excites you?",
    type: "textarea",
    placeholder: "e.g. cricket, gaming, music, startups, movies",
  },
  {
    id: "routine",
    text: "Describe a normal day — wake up, college/work, free time, sleep.",
    type: "textarea",
    placeholder: "e.g. wake 7am, college 9–4, free after 6, sleep around 1am",
  },
  {
    id: "hours",
    text: "How many hours a day can you HONESTLY give to your goal?",
    type: "choice",
    options: ["Less than 1 hour", "1–2 hours", "2–3 hours", "3–5 hours", "5+ hours"],
  },
  {
    id: "problems",
    text: "What's stopping you right now? Pick everything that's true.",
    type: "multi",
    options: [
      "Procrastination",
      "Phone / social media",
      "Don't know where to start",
      "Low motivation",
      "Stress or anxiety",
      "Poor sleep",
      "Family or financial pressure",
      "Not enough time",
      "Can't focus for long",
    ],
  },
  {
    id: "mood",
    text: "How have you been feeling lately, overall?",
    type: "scale",
    min: 1,
    max: 10,
    labels: ["Really low", "Great"],
  },
  {
    id: "coach_style",
    text: "How should your coach treat you?",
    type: "choice",
    options: ["gentle", "balanced", "strict"],
    optionLabels: {
      gentle: "Gentle friend — encouraging",
      balanced: "Balanced — supportive but direct",
      strict: "Strict teacher — scold me when I slack",
    },
  },
  {
    id: "language",
    text: "Which language should your coach talk in?",
    type: "choice",
    options: ["English", "English + Telugu", "English + Hindi"],
  },
];
