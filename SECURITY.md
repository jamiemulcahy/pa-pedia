# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please report it privately rather than opening a public issue.

**Preferred method**: Use [GitHub's private vulnerability reporting](https://github.com/jamiemulcahy/pa-pedia/security/advisories/new) for this repository.

Please include:
- A description of the issue and its potential impact
- Steps to reproduce or a proof of concept

This is an open-source hobby project maintained in spare time. Reports are appreciated but there are no guarantees on response times.

## Scope

**In scope**:
- The web application at [pa-pedia.com](https://pa-pedia.com)
- GitHub Actions workflows (especially those handling secrets)
- The CLI tool's handling of file paths and user input
- Dependencies with known vulnerabilities

**Out of scope**:
- Planetary Annihilation game client or servers
- Third-party mods themselves
- The PA base data encryption (this protects copyrighted game assets, not user data)

## Architecture Notes

For context when evaluating issues:
- The web app is fully client-side (static site on Cloudflare Pages) with no backend server or user accounts
- Faction data is public game data served from GitHub Releases
- User-uploaded factions are stored only in the user's own browser (IndexedDB)
- The only secret is `PA_BASE_DATA_KEY`, used in CI to decrypt base game data for automated faction updates
