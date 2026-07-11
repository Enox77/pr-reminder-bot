const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, ".notified-cache.json");

/**
 * Loads the cache of already-notified PRs.
 * Structure: { "owner/repo#number": lastNotifiedHoursBucket }
 * e.g. { "Enox77/test-repo#1": 24 } means we already sent a reminder
 * once it crossed the 24h bucket — we won't re-send until it crosses
 * the NEXT bucket (e.g. 48h), preventing hourly spam for the same PR.
 */
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {}; // corrupted cache file — treat as empty rather than crash
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Buckets an hours-waiting number into a threshold step, e.g. 24, 48, 72...
 * A PR waiting 26h and one waiting 30h are both in the "24h" bucket.
 */
function bucketFor(hoursWaiting, stepHours) {
  return Math.floor(hoursWaiting / stepHours) * stepHours;
}

/**
 * Filters a list of stale PRs down to only the ones we haven't
 * already notified about at their current bucket, then updates
 * the cache to record we're about to notify on them.
 *
 * @param {Array} stalePRs
 * @param {string} owner
 * @param {string} repo
 * @param {number} stepHours - re-notify every N hours (default 24)
 */
function filterUnnotified(stalePRs, owner, repo, stepHours = 24) {
  const cache = loadCache();
  const toNotify = [];

  for (const pr of stalePRs) {
    const key = `${owner}/${repo}#${pr.number}`;
    const bucket = bucketFor(pr.hoursWaiting, stepHours);
    const lastNotifiedBucket = cache[key];

    if (lastNotifiedBucket === undefined || bucket > lastNotifiedBucket) {
      toNotify.push(pr);
      cache[key] = bucket;
    }
  }

  saveCache(cache);
  return toNotify;
}

module.exports = { filterUnnotified };
