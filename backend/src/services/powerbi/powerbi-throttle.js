const generateTimestamps = [];

const LIMITS = {
  perMinute: 20,
  perHour: 200,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prune() {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  while (generateTimestamps.length && generateTimestamps[0] < hourAgo) {
    generateTimestamps.shift();
  }
}

async function throttleGenerateToken() {
  prune();
  const now = Date.now();
  const minuteAgo = now - 60 * 1000;
  const inMinute = generateTimestamps.filter((t) => t >= minuteAgo).length;
  const inHour = generateTimestamps.length;

  if (inMinute >= LIMITS.perMinute || inHour >= LIMITS.perHour) {
    await sleep(1500);
    return throttleGenerateToken();
  }

  generateTimestamps.push(now);
}

module.exports = {
  throttleGenerateToken,
};
