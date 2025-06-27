# Project Overview

Smart Site Redirector is a Manifest V3 browser extension that redirects distracting sites to safer destinations. Rules are managed by `background.js` using `declarativeNetRequest` while `popup.js` powers the configuration UI.

### Key Files
- **manifest.json** – extension configuration and permissions
- **background.js** – service worker with redirect logic
- **popup.js** – UI logic for managing rules and whitelist
- **updates.md** – security notes and planned improvements

### Development
Run simple syntax checks with:

```bash
node -c popup.js
node -c background.js
```

This repository currently focuses on minimizing host permissions. Optional host permissions allow prompting for new domains when users add them to rules or the whitelist.
