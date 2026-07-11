const { getStalePRs } = require("./checkStalePRs");
const { sendSlackReminder } = require("./sendSlackReminder");
const { filterUnnotified } = require("./notifyCache");

async function main() {
  const threshold = process.argv[4] !== undefined
    ? Number(process.argv[4])
    : (process.env.THRESHOLD_HOURS !== undefined ? Number(process.env.THRESHOLD_HOURS) : 24);

  const token = process.env.GITHUB_TOKEN;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("Missing SLACK_WEBHOOK_URL environment variable.");
    process.exit(1);
  }

  // Support either a single owner/repo via CLI args (for quick manual testing),
  // or a REPO_LIST env var like "owner1/repo1,owner2/repo2" for real usage.
  let repos = [];

  if (process.argv[2] && process.argv[3]) {
    repos = [{ owner: process.argv[2], repo: process.argv[3] }];
  } else if (process.env.REPO_LIST) {
    repos = process.env.REPO_LIST.split(",").map((entry) => {
      const [owner, repo] = entry.trim().split("/");
      return { owner, repo };
    });
  } else if (process.env.REPO_OWNER && process.env.REPO_NAME) {
    repos = [{ owner: process.env.REPO_OWNER, repo: process.env.REPO_NAME }];
  } else {
    console.error(
      "No repos configured. Set REPO_LIST=owner1/repo1,owner2/repo2 in your .env, " +
      "or pass owner and repo as CLI args: node run.js <owner> <repo> [thresholdHours]"
    );
    process.exit(1);
  }

  for (const { owner, repo } of repos) {
    if (!owner || !repo) {
      console.error(`Skipping invalid entry in REPO_LIST: "${owner}/${repo}"`);
      continue;
    }

    console.log(`Checking ${owner}/${repo} for PRs stale > ${threshold}h...`);

    try {
      const stale = await getStalePRs(owner, repo, { thresholdHours: threshold, token });
      console.log(`Found ${stale.length} stale PR(s) in ${owner}/${repo}.`);

      const toNotify = filterUnnotified(stale, owner, repo, threshold || 24);
      console.log(`${toNotify.length} of those haven't been notified about yet at this threshold.`);

      const result = await sendSlackReminder(toNotify, webhookUrl);

      if (result.sent) {
        console.log(`Sent Slack message for ${result.count} PR(s) in ${owner}/${repo}. ✅`);
      } else {
        console.log(`Nothing sent for ${owner}/${repo} — ${result.reason}. ✅`);
      }
    } catch (err) {
      console.error(`Error checking ${owner}/${repo}:`, err.message);
    }
  }
}

main();
