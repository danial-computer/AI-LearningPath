const NICKNAME = "Scholar";

const timeGreetings = {
  morning: [
    `Good morning, ${NICKNAME}! ☀️`,
    `Morning, ${NICKNAME}! Ready to learn today? 💪`,
    `Hey ${NICKNAME}! Great morning to study`,
    `Rise and shine, ${NICKNAME}! Let's get started`,
  ],
  afternoon: [
    `Good afternoon, ${NICKNAME}! ☀️`,
    `Hey ${NICKNAME}! Keep up the great work`,
    `Afternoon, ${NICKNAME}! What are we learning today?`,
    `Good afternoon, ${NICKNAME}! Stay focused 💪`,
  ],
  evening: [
    `Good evening, ${NICKNAME}! 🌙`,
    `Evening, ${NICKNAME}! Still grinding? 🔥`,
    `Good evening, ${NICKNAME}! Night sessions hit different 🌙`,
    `Hey ${NICKNAME}! Late night study session? Let's go`,
  ],
};

const funGreetings = [
  `Hey ${NICKNAME}, long time no see! Missed studying together 😄`,
  `Welcome back, ${NICKNAME}! Ready to grind? 🔥`,
  `Oh ${NICKNAME}'s here! Let's get straight to it 🚀`,
  `${NICKNAME} is back! Consistency is key 💎`,
  `Heyy ${NICKNAME}! Look at you showing up, legend! 🌟`,
];

/** Subtitle displayed below the main greeting */
export const GREETING_SUBTITLE =
  "What do you want to learn today? Ask anything about your coursework.";

/**
 * Generate a dynamic greeting based on time of day.
 * ~30% chance to use a fun/random greeting instead.
 */
export function getGreeting(): string {
  // 30% chance for fun greeting
  if (Math.random() < 0.3) {
    const idx = Math.floor(Math.random() * funGreetings.length);
    return funGreetings[idx];
  }

  const hour = new Date().getHours();
  let pool: string[];

  if (hour >= 5 && hour < 12) {
    pool = timeGreetings.morning;
  } else if (hour >= 12 && hour < 17) {
    pool = timeGreetings.afternoon;
  } else {
    pool = timeGreetings.evening;
  }

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
