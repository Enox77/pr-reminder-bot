const { getStalePRs } = require("./checkStalePRs");

async function main() {
  const owner = process.argv[2] || "facebook";
  const repo = process.argv[3] || "react";
  const threshold = process.argv[4] !== undefined ? Number(process.argv[4]) : 24;

  console.log(`Checking ${owner}/${repo} for PRs stale > ${threshold}h...\n`);

  try {
    const token = process.env.GITHUB_TOKEN; // set this before running, see README
    const stale = await getStalePRs(owner, repo, { thresholdHours: threshold, token });

    if (stale.length === 0) {
      console.log("No stale PRs found. ✅");
    } else {
      console.log(`Found ${stale.length} stale PR(s):\n`);
      for (const pr of stale) {
        console.log(`⏰ #${pr.number} "${pr.title}" — waiting ${pr.hoursWaiting}h`);
        console.log(`   by @${pr.author} | ${pr.url}`);
        if (pr.requestedReviewers.length) {
          console.log(`   reviewers: ${pr.requestedReviewers.join(", ")}`);
        }
        console.log("");
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
    if (err.status === 403) {
      console.error("Likely hit GitHub's unauthenticated rate limit (60 req/hour). Pass a token to increase this.");
    }
  }
}

main();
