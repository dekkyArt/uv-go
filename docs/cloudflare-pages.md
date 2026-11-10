# Deploying to Cloudflare Pages

After the one-time setup, every push to `main` (including a merged pull request)
runs `.github/workflows/ci.yml`: lint → type checking → unit tests → E2E →
build → JavaScript size check → Lighthouse. Only after all checks succeed does
the `deploy` job upload the built `dist/` to Cloudflare Pages.
On pushes to `main`, the checks are followed by a production build with the optional
`PUBLIC_GA_MEASUREMENT_ID` variable and a JS size check. Cloudflare does not rebuild
the upload. Pull requests, other branches and tags run CI without publishing or
using the Cloudflare token.

This uses **Pages Direct Upload through Wrangler**, with the build running in GitHub
Actions on the Node version from `.nvmrc`. Astro already uses `output: 'static'`;
no server, Cloudflare adapter or Pages Functions are needed.

## 1. Create a Pages project

You need GitHub repository administrator permissions and access to the Cloudflare account.
Run locally from the repository root:

```bash
npx wrangler@4 login
npx wrangler@4 pages project create
```

Select the account, set a project name (for example, `uv-go`) and production branch
**`main`**. Save the actual project name and address: Cloudflare may append a suffix
to the `*.pages.dev` address if the requested address is taken.

Create a **Pages** project, not a Worker. Do not enable Cloudflare's automatic Git
builds: GitHub Actions manages deployment, and enabling them would create a second,
independent deployment path that does not wait for CI checks. For an existing project
with Git integration, disable automatic production/preview deployments first.
Switching Direct Upload to Git integration later requires a new project.

## 2. Create a token

In Cloudflare, open **API Tokens → Create Token → Custom Token**:

- Name: for example, `GitHub Actions — UV GO Pages`.
- Permission: **Account → Cloudflare Pages → Edit**.
- Account Resources: **Include → Specific account → your account**.

Copy the token immediately after creating it. Find the Account ID in the Cloudflare
dashboard for the same account (this is not the Zone ID). Do not store the token in the repository.

## 3. Configure GitHub Actions

In the repository, open **Settings → Secrets and variables → Actions**.

Under **Secrets**, add these repository secrets:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The API token you created |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID of the account containing the Pages project |

Under **Variables**, add these repository variables:

| Name | Value |
| --- | --- |
| `PUBLIC_GA_MEASUREMENT_ID` | Optional: GA4 Measurement ID such as `G-XXXXXXXXXX`; an empty value disables analytics |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | Exact project name from step 1, such as `uv-go`; without a URL or `.pages.dev` |

In **Settings → Actions → General**, allow GitHub Actions and the actions
`actions/*`, `cloudflare/wrangler-action`. The workflow uses only `contents: read`
for GitHub; it does not need write access to the repository.

## 4. Set the public URL

The primary production URL is already set in `src/site.config.ts`:

```ts
site: 'https://uv-go.dekky.dev',
```

This address is used in canonical links, Open Graph, JSON-LD, the sitemap and `robots.txt`.
Before publishing, connect `uv-go.dekky.dev` under **Pages → your project → Custom domains**
and wait for the domain and HTTPS to become active. Then publish a new build.
Environment settings in the Pages dashboard do not change the site: builds run in GitHub.

If the old Vercel domain or a `*.pages.dev` address is publicly accessible, configure
a permanent redirect at the hosting layer to `https://uv-go.dekky.dev`, preserving the
path and query string. Do not add an unconditional redirect to the same domain in
shared site rules: it would create a loop. After publishing, check the canonical URL
and submit `https://uv-go.dekky.dev/sitemap-index.xml` to Google Search Console and Bing Webmaster Tools.

## 5. First deployment and verification

1. Push the workflow and site configuration changes to `main`.
2. In GitHub, open **Actions → CI** for that commit. Wait for the `build` and
   `Deploy to Cloudflare Pages` jobs to succeed.
3. Find the deployment URL in the `Deploy static site` step log. In Cloudflare, open
   **Workers & Pages → your project → Deployments** and verify the production deployment
   for the `main` branch with the expected commit.
4. Open the production URL, the `/uv-index/` article, `/robots.txt` and
   `/sitemap-index.xml`. Check city selection and forecast loading.
5. Make another commit on `main` and verify that production updates.

To retry, use **Re-run failed jobs** on the current CI run; if the artifact has already
been deleted (retention is seven days), choose **Re-run all jobs**.
Re-running an old commit can publish an old version, so choose the latest commit on
`main`. New CI runs cancel the previous run for the same branch; if its deployment
has already completed, the new run replaces it after passing the checks.

## If deployment fails

- `Set ... repository secret/variable`: fill in the settings from step 3.
- Authorization error: check token expiration, the Pages Edit permission and Account ID.
- Project not found: check the project name and selected account.
- A preview appeared instead of production: the project's production branch must be `main`.
- `deploy` was skipped: this is expected for PRs, tags and branches other than `main`;
  also check the `build` result. If checks fail, the current production version remains available.
- Error in `build`: fix the failing check; deployment will not start until it passes.

To roll back, open a previous successful production deployment in Cloudflare Pages
and select **Rollback to this deployment**. Then fix or revert the problematic commit
on `main`; otherwise the next successful CI run will publish that branch's contents again.

## Documentation

- [Cloudflare: Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare: creating a Direct Upload project](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Wrangler GitHub Action](https://github.com/cloudflare/wrangler-action)
- [Deployment rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
