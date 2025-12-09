# RouteDash Platform

[![Backend CI](https://img.shields.io/github/actions/workflow/status/RAdityaBaradwaj/CSC510_G20/backend-ci.yml?branch=main&label=Backend%20CI)](https://github.com/RAdityaBaradwaj/CSC510_G20/actions/workflows/backend-ci.yml)
[![Frontend CI](https://img.shields.io/github/actions/workflow/status/RAdityaBaradwaj/CSC510_G20/frontend-ci.yml?branch=main&label=Frontend%20CI)](https://github.com/RAdityaBaradwaj/CSC510_G20/actions/workflows/frontend-ci.yml)
[![Lint](https://img.shields.io/github/actions/workflow/status/RAdityaBaradwaj/CSC510_G20/lint.yml?branch=main&label=Lint)](https://github.com/RAdityaBaradwaj/CSC510_G20/actions/workflows/lint.yml)
[![Formatting](https://img.shields.io/github/actions/workflow/status/RAdityaBaradwaj/CSC510_G20/format.yml?branch=main&label=Prettier)](https://github.com/RAdityaBaradwaj/CSC510_G20/actions/workflows/format.yml)
[![Type Safety](https://img.shields.io/github/actions/workflow/status/RAdityaBaradwaj/CSC510_G20/typecheck.yml?branch=main&label=Type%20Check)](https://github.com/RAdityaBaradwaj/CSC510_G20/actions/workflows/typecheck.yml)
[![Coverage](https://img.shields.io/codecov/c/github/RAdityaBaradwaj/CSC510_G20/main?label=Coverage)](https://app.codecov.io/gh/RAdityaBaradwaj/CSC510_G20)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![DOI](https://img.shields.io/badge/DOI-Zenodo_pending-blue.svg)](https://zenodo.org/)

RouteDash is a travel-aware meal planning experience that pairs in-flight drive routes with real-time restaurant availability. This repository contains:

- **`proj2/server`** — Express + Prisma API that manages authentication, restaurants, menus, and order fulfillment.
- **`proj2/routedash`** — Expo/React Native client for customers and restaurant owners.
- **`proj1/`** — Milestone 1 artifacts (archived; kept for grading reference).

> ℹ️ All new development happens on feature branches merged into `main` through pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching workflow and review checklist.

---

## Demo

<p align="center">
  <a href="https://drive.google.com/file/d/1ViCX3mGHlqICUd-yVTK0lo9NviR4jtPX/view?usp=sharing">
    <img src="https://img.shields.io/badge/▶_Watch_Demo-Google_Drive-4285F4?style=for-the-badge&logo=googledrive&logoColor=white" alt="Watch Demo Video"/>
  </a>
</p>

The demo showcases:

- Customer flow: register, set a route, browse nearby restaurants, and place a pickup order.
- Merchant flow: log in, curate the menu, and step through order preparation stages.
- Coordinated updates: status changes propagate to the mobile client in real time.

## Quick Start

| Task | Command |
|------|---------|
| Install backend deps | `cd proj2/server && npm install` |
| Install frontend deps | `cd proj2/routedash && npm install` |
| Provision `.env` files | `cp .env.example .env` in both `server` and `routedash` |
| Generate Prisma client | `npm run prisma:generate` |
| Run migrations + seed data | `npm run db:migrate && npm run db:seed` |
| Start backend | `npm run dev` |
| Launch Expo app | `npm start` |

Detailed instructions live in [INSTALL.md](INSTALL.md). If you are setting up a shared database or Expo EAS builds, consult the [deployment guide](proj2/docs/deployment.md).

## Architecture At A Glance

- **API (TypeScript/Express/Prisma)**  
  Modular service layer with strict schema validation via `zod`, JWT session management, and granular role-based access control middleware.

- **Mobile app (Expo + React Native)**  
  Navigation built with React Navigation, Google Maps directions integration, persistent auth via secure cookies, and offline-aware API client wrappers.

- **Data layer**  
  PostgreSQL schema modeled in `prisma/schema.prisma`, migrations managed via `npm run db:migrate`, and seed data for local demos in `prisma/seed.ts`.

- **Quality gates**  
  GitHub Actions enforce formatting (`prettier`), linting (`eslint` across API and app), type safety (`tsc`), unit tests (`vitest` with coverage), and dependency auditing (`npm audit --production`).

## Project Documentation

- [INSTALLATION GUIDE](INSTALL.md)
- [API reference & data contracts](proj2/docs/api.md)
- [Sustainability self-assessment](proj2/docs/sustainability-evaluation.md)
- [Repository health rubric](proj2/docs/repository-rubric.md)
- [Dependency catalog](proj2/docs/dependencies.md)
- [Accessibility checklist](proj2/docs/accessibility.md)
- [Governance & roadmap](proj2/docs/governance.md)
- [Community & outreach plan](proj2/docs/community.md)
- [Contribution guidelines](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [License](LICENSE.md)
- [Changelog](CHANGELOG.md)

## Testing & Coverage

- 170+ automated Vitest specs (unit + integration) covering services, middleware, and critical React Native components.
- Coverage thresholds: **90% statements**, **90% branches**, **90% lines**, enforced in `vitest.config.ts`.
- CI publishes coverage artifacts to Codecov for historical tracking. See the [coverage dashboard](https://app.codecov.io/gh/RAdityaBaradwaj/CSC510_G20) for current metrics.
- For manual runs:

  ```bash
  cd proj2/server
  npm run test:coverage
  ```

  Coverage reports are written to `proj2/server/coverage/`.

## Team Practices

- **Parallel work:** Every feature ships through pull requests reviewed by at least one teammate. Merged PR history and assignees are tracked under [Insights → Pull requests](https://github.com/RAdityaBaradwaj/CSC510_G20/pulls?q=is%3Apr+is%3Amerged).
- **Issue triage:** Bugs and enhancements live in [GitHub Issues](https://github.com/RAdityaBaradwaj/CSC510_G20/issues); templates capture repro steps and acceptance criteria.
- **Communication:** Daily syncs in the private Discord (QR code in [proj2/docs/poster.pdf](proj2/docs/poster.pdf)), with weekly summaries mirrored to the issue tracker.
- **Release cadence:** Tagged releases (`v0.x`) every Friday aggregate the week’s completed stories.

## Releases & Roadmap

- `CHANGELOG.md` captures every tagged release and the planned next steps.
- Prebuilt artefacts (Docker image, backend tarball, Expo builds) accompany each release on GitHub and are referenced in [proj2/docs/deployment.md](proj2/docs/deployment.md).
- Governance, funding updates, and the 3/6/12 month roadmap are documented in [proj2/docs/governance.md](proj2/docs/governance.md).

## Acknowledgements

Built by CSC510 Group 20 — Sanjana Chandrashekar, [teammates list](proj2/docs/team.md). Special thanks to the CSC510 teaching staff for guidance.

---

For questions, open an issue or email `team@routedash.dev` (goes to the full team). For security disclosures, follow the steps in [SECURITY.md](SECURITY.md). Release notes live in [CHANGELOG.md](CHANGELOG.md); weekly tags (`v0.x`) summarise merged pull requests and updated Expo builds.
