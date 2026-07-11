/**
 * Sends stale PR reminders to a Slack channel via an Incoming Webhook.
 *
 * @param {Array} stalePRs - output from getStalePRs()
 * @param {string} webhookUrl - Slack Incoming Webhook URL
 */
async function sendSlackReminder(stalePRs, webhookUrl) {
  if (stalePRs.length === 0) {
    // Nothing to send — don't spam the channel with "all clear" messages
    return { sent: false, reason: "no stale PRs" };
  }

  const lines = stalePRs.map((pr) => {
    const reviewers = pr.requestedReviewers.length
      ? ` (reviewers: ${pr.requestedReviewers.map((r) => `@${r}`).join(", ")})`
      : "";
    return `⏰ *<${pr.url}|#${pr.number} ${pr.title}>* — waiting ${pr.hoursWaiting}h, opened by @${pr.author}${reviewers}`;
  });

  const message = {
    text: `*${stalePRs.length} PR(s) waiting for review:*\n${lines.join("\n")}`,
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${body}`);
  }

  return { sent: true, count: stalePRs.length };
}

module.exports = { sendSlackReminder };
