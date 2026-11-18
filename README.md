# Compact Watch

[Live site](https://pinkrose237.github.io/npvic/) tracking Arizona, Michigan, Nevada, Pennsylvania, and Wisconsin ahead of the National Popular Vote Interstate Compact’s July 20, 2028 cutoff.

## Run locally

Node.js 24 or later is supported.

```sh
npm ci
npm test
npm run build
npx --yes serve dist
```

Run `npm run refresh` to collect fresh evidence and rebuild the snapshot. For AI news triage, supply an OpenCode Go key in the `OPENCODE_GO_API_KEY` environment variable. The GitHub Pages workflow uses the same name as a repository Actions secret. The site serves static files and never receives the key.

## Forecast

The target is at least 270 electoral votes represented by compact members on July 20, 2028, with uncertain additions limited to the five tracked states. It assumes the current member base persists until a source reports a change. Congressional action, judicial review, and election administration are separate from the membership estimate.

The baseline uses the next two calendar years for historical nonmember states that gained Democratic trifectas in 2018, 2019 and 2022. It uses a Beta(1,1) prior and reports leave-one-election-out Brier error for the baseline. The full forecast adds judgment-based log-odds adjustments for verified legislative milestones, reviewed political signals and time left in session. The outcomes of all 32 possible initial combinations are enumerated in three shared political environments. The displayed sensitivity range applies a common log-odds shift of ±0.85, separate from the shared environment. It is a scenario range. The seven-case baseline is too small to establish strong calibration, and the state-level adjustments are not fitted to those cases.

An incoming legislature’s bills drive its stage. Earlier filings remain visible as history. A constitutional amendment is tracked as a lead, with its separate ballot timeline. For Nevada, the model treats the 2027 regular session as the central route and leaves a small allowance for extraordinary legislative action.

## Data and revisions

The Pages workflow polls daily and can be dispatched manually. It gathers state and national headlines from Google News RSS, changes from StateScan RSS, bill leads from the MediaWiki API and National Popular Vote, and membership from NCSL, with a cross-checked fallback when NCSL is unavailable. It checks official bill searches in Michigan, Nevada, Pennsylvania and Wisconsin, and verifies Arizona bill actions through its legislature’s API. Official bill records support stage changes. Feed outages preserve prior evidence and are shown in the methodology panel. The AI classifies public headlines with DeepSeek V4.1 Flash. News volume and AI classifications carry zero forecast weight.

`data/inputs.mjs` contains the sourced starting records and reviewed political assumptions. `site/data/snapshot.json` contains the current result. `site/data/revisions.json` records changes to the published probability, verified bill milestones, or other model inputs. Git history keeps each published snapshot. Bump `modelVersion` when the model methodology changes. A refresh uses the existing default branch, and GitHub Actions serializes deployments.

The [video brief](https://www.youtube.com/watch?v=mlT1dY4xV8o) informed the paths calculator, Nevada’s legislative window, and the distinction between reaching 270 and using the compact in an election. The [electoral-vote allocation](https://www.archives.gov/electoral-college/allocation), [compact text](https://www.nationalpopularvote.com/bill-text) and [Nevada’s 2027 calendar](https://www.leg.state.nv.us/App/NELIS/REL/84th2027/SessionInformation) support those features.
