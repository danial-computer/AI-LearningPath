const NICKNAME = "Mahasiswa";

const timeGreetings = {
  morning: [
    `Selamat pagi, ${NICKNAME}! ☀️`,
    `Good morning, ${NICKNAME}! Semangat belajar hari ini 💪`,
    `Pagi, ${NICKNAME}! Siap belajar bareng?`,
    `Halo ${NICKNAME}! Pagi yang cerah buat belajar nih`,
  ],
  afternoon: [
    `Selamat siang, ${NICKNAME}! ☀️`,
    `Halo, ${NICKNAME}! Yuk lanjut belajar`,
    `Siang, ${NICKNAME}! Ada yang bisa dibantu hari ini?`,
    `Good afternoon, ${NICKNAME}! Semangat terus ya`,
  ],
  evening: [
    `Selamat malam, ${NICKNAME}! 🌙`,
    `Good evening, ${NICKNAME}! Masih semangat belajar?`,
    `Wilujeng wengi, ${NICKNAME}! 🌙`,
    `Malam, ${NICKNAME}! Belajar malam memang tenang ya`,
  ],
};

const funGreetings = [
  `Oiii lama ga liat, ${NICKNAME}! Kangen belajar bareng nih 😄`,
  `Wilujeng sumping, ${NICKNAME}! Siap grinding? 🔥`,
  `Eh ${NICKNAME} udah dateng aja! Yuk langsung gas belajar 🚀`,
  `Wah ${NICKNAME} balik lagi! Konsistensi adalah kunci 💎`,
  `Heyy ${NICKNAME}! Tumben rajin nih, keren! 🌟`,
];

/** Subtitle hint ditampilkan di bawah greeting utama */
export const GREETING_SUBTITLE =
  "Mau belajar apa hari ini? Tanya apapun tentang materi kuliahmu.";

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
