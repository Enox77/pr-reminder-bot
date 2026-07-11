# PR Reminder Bot

Checks your GitHub repos for open, non-draft pull requests that have no
reviews yet and have been sitting for longer than a threshold you choose
(default 24 hours). Sends a Slack message listing them. Runs on a schedule
so you don't have to think about it.

## What you need

- Node.js 18+ installed (`node -v` to check)
- A GitHub account with access to the repo(s) you want to monitor
- A Slack workspace where you can add an app

## Setup

**Option A — guided setup (recommended)**

```bash
npm install
npm run setup
```

This asks for your GitHub token, Slack webhook, and repos, writes your
`.env` file, runs a test check, and — on Linux with systemd — offers to
set up automatic hourly scheduling for you. If anything looks wrong
along the way, the manual steps below explain what each piece does.

**Option B — manual setup**

**1. Install dependencies**

```bash
npm install
```

**2. Get a GitHub token**

- Go to [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
- Click **Generate new token**
- Under **Repository access**, select the repo(s) you want to monitor
- Under **Permissions** → **Repositories** tab → **Pull requests** → set to **Read-only**
- Generate, then copy the token (starts with `github_pat_`)

**3. Get a Slack webhook**

- Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
- Name it anything, pick your workspace
- Left sidebar → **Incoming Webhooks** → toggle **Activate Incoming Webhooks** on
- Click **Add New Webhook to Workspace**, pick a channel, click **Allow**
- Copy the URL (starts with `https://hooks.slack.com/services/`)

**4. Configure**

Copy the example env file and fill in your real values:

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `GITHUB_TOKEN` — from step 2
- `SLACK_WEBHOOK_URL` — from step 3
- `REPO_LIST` — comma-separated `owner/repo` pairs, e.g. `torvalds/linux,facebook/react`
- `THRESHOLD_HOURS` — how many hours before a PR counts as stale (default 24)

**5. Run it once manually to confirm it works**

```bash
export $(cat .env | xargs)
node run.js
```

You should see it check each repo and report how many stale PRs it found.
If you have an open PR with no reviews, lower `THRESHOLD_HOURS` to `0`
temporarily to force a hit while testing.

## Running it automatically

You want this checking on a schedule, not something you run by hand every
time. Pick whichever matches your system:

### Linux (systemd — recommended if your distro uses systemd)

Create `~/.config/systemd/user/pr-reminder.service`:

```ini
[Unit]
Description=PR Reminder Bot

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/pr-reminder-bot
EnvironmentFile=/absolute/path/to/pr-reminder-bot/.env
ExecStart=/absolute/path/to/node run.js
```

(Find your node path with `which node`.)

Create `~/.config/systemd/user/pr-reminder.timer`:

```ini
[Unit]
Description=Run PR Reminder Bot every hour

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h

[Install]
WantedBy=timers.target
```

Enable it:

```bash
systemctl --user daemon-reload
systemctl --user enable --now pr-reminder.timer
systemctl --user list-timers
```

Check logs any time with:

```bash
journalctl --user -u pr-reminder.service -n 20 --no-pager
```

### macOS / Linux (cron — simpler, works everywhere)

```bash
crontab -e
```

Add a line (adjust paths to match your setup):

```
0 * * * * cd /absolute/path/to/pr-reminder-bot && export $(cat .env | xargs) && /path/to/node run.js >> ~/pr-reminder.log 2>&1
```

### Anywhere (Cloudflare Workers, GitHub Actions, etc.)

This is plain Node.js with no persistent server needed per run, so it
also works as a scheduled GitHub Action or Cloudflare Worker Cron
Trigger if you'd rather not manage your own machine's uptime. Not
covered here — ask if you want help setting that up.

## How the "don't repeat yourself" logic works

The bot keeps a small local file (`.notified-cache.json`) tracking which
PRs it's already flagged and at what age. It won't re-notify about the
same PR until it crosses into the *next* threshold multiple — e.g. with
a 24h threshold, a PR gets flagged once at 24h, then again at 48h if
still unreviewed, and so on. This means you can run the check as often
as you like (every 15 minutes, every hour) without getting spammed.

## Files

- `checkStalePRs.js` — core logic, talks to the GitHub API
- `sendSlackReminder.js` — formats and sends the Slack message
- `notifyCache.js` — the dedupe logic described above
- `run.js` — ties it all together, reads config from `.env`
- `.env.example` — template for your own `.env` (never commit a filled-in `.env`)

## Security note

Your `.env` file contains real secrets (a GitHub token and a Slack
webhook URL). Don't commit it to a public repo, don't paste it into
chat tools, and revoke/regenerate both if you ever accidentally expose
them.
