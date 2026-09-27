This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Requirements: Node.js 20.9+ and npm.

First, run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment configuration

The Firebase web configuration used for local development is committed in
`.env.development`, so a developer can clone the repository, run `npm ci`, and
start the app without exchanging an env file. Every variable in that file is
prefixed with `NEXT_PUBLIC_`, which means Next.js includes it in the browser
bundle; it must never contain a server credential or other secret.

Use `.env.local` for personal overrides. Next.js loads it automatically and Git
ignores it. `.env.example` documents the supported variable names.

Access control is enforced by `firestore.rules`, not by the browser-visible
allowlist alone. `NEXT_PUBLIC_ALLOWED_AUTH_EMAILS` is the bootstrap-admin list;
new Google accounts create an `accessRequests` record and an approved owner grants access
from the `/users` page. Approved access is stored in `accessControl`.

When the bootstrap-admin list or access rules change, update
`isBootstrapAdmin()` in `firestore.rules` and deploy the rules as part of the
same change:

```bash
npx firebase-tools deploy --only firestore:rules --project <firebase-project-id>
```

For production, set the same variables in the deployment platform rather than
relying on the development file.

### Shared Beyond Dev workspace

The login brand asset at `public/beyonddev-logo.png` is the original company
logo from `https://beyonddevtechsolution.com/brand/beyonddev-logo.png`.

All approved Google accounts use the existing company configured in
`src/config/workspace.ts`. There is no company creation or account-specific
company selection. The old company data is not moved or deleted.

Every approved account is an equal owner: it can create/edit business data and
approve, reject, or revoke other members from `/users`. The legacy internal role
name is `admin`; existing approved records with `role: "user"` receive the same
permissions without a data migration. Bootstrap accounts retain recovery access.
Pending, rejected, unverified, and non-Google accounts cannot access business data.

The shared company ID is public routing configuration, not a credential. Keep it
in sync with `firestore.rules`. Rules deny access to other companies, prevent
changing a record's company/creator, and deny creating or archiving the shared
company. If it cannot be loaded, the app shows an error rather than creating an
empty replacement.

Validate before release:

```bash
npm run lint
npm run build
node scripts/test-workspace-rules.mjs /path/to/firebase-tools signed-in-cli-account@example.com
```

The rules test uses the Firebase Rules dry-run API with mocked document lookups.
It does not write business data or publish rules. Authenticate the CLI first;
never put credentials in this script.

Release the built app and rules together; old clients use per-owner company
queries and are incompatible with the shared-workspace rules:

```bash
npx firebase-tools deploy --only hosting,firestore:rules --project doc-flow-8a352
```

After release, refresh existing browser tabs. To roll back, restore both the
previous hosting release and its matching ruleset; do not delete company data.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Company business card

The company page uses HeroUI Pro `HoloCard`. Mobile/touch and reduced-motion
preferences keep the card still; PNG export includes only the card, not controls.
The card uses the bundled high-resolution Beyond Dev brand logo (document-upload
logos and signer information remain private).

Owners explicitly publish a snapshot containing only name/nameEn, tax ID,
address, phone and email. `publicCompanyCards/{random20CharacterId}` permits
single-document public reads, never list queries. Private `companyCardSettings`
stores the current link; transactions serialize updates and revocation. Revoking
deletes the public snapshot; publishing again generates a new link. Previously
downloaded images cannot be recalled. Company edits do not silently update the
published snapshot; use **อัปเดตข้อมูลที่เผยแพร่**.

Deploy **hosting and firestore:rules together** before using external sharing.
Generate external links on the production site; localhost links are local only.
No public snapshots are created automatically by deployment or page views.

Checks: `node scripts/test-company-card.mjs` and the existing
`scripts/test-workspace-rules.mjs` dry-run suite (includes public-card boundaries).
