const KEY = "erie-tutorial-done";

export type TutorialStep = { title: string; body: string };

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Erie Steel",
    body: "Auction private charters, float railroad companies, lay track from Cleveland toward New York, and race the bank. This tour takes under a minute — Skip anytime.",
  },
  {
    title: "Charter auction",
    body: "A charter (private company) pays income and often has a special ability. Buy one when it is your turn, or pass. When they are gone, the stock round opens.",
  },
  {
    title: "Float a company",
    body: "Start a corporation at a par price by buying the president's certificate (two shares). When enough shares sell, the company floats — treasury fills and it can operate.",
  },
  {
    title: "Operating rounds (OR)",
    body: "In an OR the president lays track, may place a station token, runs trains (pay dividends or withhold), then may buy a train. Loans of $100 keep a cash-poor road moving.",
  },
  {
    title: "You are ready",
    body: "Practice hotseat plays every seat yourself. Watch bots (Potato) lets AIs play with a play-by-play feed — take control of any seat anytime. Online tables use a 4-letter code.",
  },
];

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetTutorialForTests(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
