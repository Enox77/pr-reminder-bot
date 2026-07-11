const { Octokit } = require("@octokit/rest");

/**
 * Finds open PRs that have been waiting for review too long.
 *
 * "Waiting for review" = no review submitted AND no new commit
 * since the PR was opened or last updated, older than thresholdHours.
 *
 * @param {string} owner - repo owner, e.g. "facebook"
 * @param {string} repo - repo name, e.g. "react"
 * @param {object} options
 * @param {string} [options.token] - GitHub personal access token (optional for public repos, but rate-limited without one)
 * @param {number} [options.thresholdHours=24] - how many hours before a PR counts as "stale"
 */
async function getStalePRs(owner, repo, options = {}) {
  const { token, thresholdHours = 24 } = options;

  const octokit = new Octokit(token ? { auth: token } : {});

  // 1. Get all open PRs
  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 50,
  });

  const stalePRs = [];

  for (const pr of pulls) {
    // Skip draft PRs — nobody expects those reviewed yet
    if (pr.draft) continue;

    // 2. Get reviews already submitted on this PR
    const { data: reviews } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: pr.number,
    });

    const hasReview = reviews.length > 0;
    if (hasReview) continue; // already reviewed at least once, not our concern for v1

    // 3. Calculate how long it's been waiting since last update
    const lastUpdated = new Date(pr.updated_at);
    const hoursWaiting = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursWaiting >= thresholdHours) {
      stalePRs.push({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        hoursWaiting: Math.round(hoursWaiting),
        requestedReviewers: pr.requested_reviewers?.map((r) => r.login) || [],
      });
    }
  }

  return stalePRs;
}

module.exports = { getStalePRs };
