# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- **Traveler Filters** – Filter restaurants by fast service, dietary needs (vegetarian/vegan), local favorites, and price range (budget/mid/upscale).
- Expo EAS build artefacts published under Releases (Android `.apk`, iOS `.ipa` test build).
- Accessibility audit (WCAG 2.1 AA) scheduled with findings to be documented in `proj2/docs/accessibility.md`.

## [0.6.0] - 2025-11-19
### Added
- **Gas/EV Stop Integration** – Users can find and add gas stations or EV charging stations along their route
  - Vehicle type selection (Gas/EV) stored in user profile
  - Separate refueling time slider independent from mealtime slider
  - Filter to show restaurants only, stations only, or both
  - Gas stations and restaurants can be added as waypoints to routes
  - Route overview section showing complete route sequence with visual indicators
  - Google Maps export with all waypoints in correct order
- **User Profile API** – New `PATCH /api/auth/profile` endpoint to update user preferences (vehicleType)
- **Database Schema** – Added `vehicleType` field to User model (nullable, supports "GAS", "EV", or null)
- **Route Management** – Unified "Route stops" section showing all stops (restaurants and gas/EV stations) with type indicators
- **Fuel Pricing** – Integration with Places API (New) for gas station fuel prices (when available)

### Changed
- Route planner now supports multiple waypoints (restaurants and gas/EV stations)
- Restaurant recommendations can be added directly to route (tap to add, long press for menu)
- Route recalculation includes all waypoints in correct order
- Updated API documentation to include profile endpoint and vehicleType field

### Technical
- Created shared route calculation utilities (`routeCalculations.ts`) for distance and coordinate calculations
- Added hooks: `useGasStations`, `useEVStations`, `useGasStationDetails`, `useUserProfile`
- Enhanced `useDirections` hook to support waypoints parameter
- Improved error handling for Places API (New) fuel pricing integration

## [0.5.0] - 2025-11-06
### Added
- 100+ backend unit tests (Vitest) covering auth, menu management, order lifecycle, and infrastructure helpers.
- GitHub Actions workflows for linting, formatting, typed builds, backend test suite, and Codecov coverage uploads.
- Full documentation suite: installation, deployment, API reference, sustainability self-assessment, repository rubric, and team poster assets.
- Project governance documents (`CODE_OF_CONDUCT`, `CONTRIBUTING`, `SECURITY`) and license (MIT).

### Changed
- README revamped with badges, demo embed, quick-start table, and testing instructions.
- Prisma service layer hardened with stricter error handling and audit logging coverage.

### Fixed
- Type-check errors in restaurant menu section updates and missing type definitions for `bcryptjs`.

[Unreleased]: https://github.com/RAdityaBaradwaj/CSC510_G20/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/RAdityaBaradwaj/CSC510_G20/releases
