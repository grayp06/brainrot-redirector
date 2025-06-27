# Smart Site Redirector

Smart Site Redirector is a browser extension built on Manifest V3 that helps steer
you away from distracting websites by automatically redirecting them to more
productive alternatives. The service worker (`background.js`) manages a set of
redirect rules and applies them using Chrome's `declarativeNetRequest` API.
A popup interface (`popup.html` and `popup.js`) lets you configure rules, manage
whitelisted domains and control privacy settings.

## Features

- **Custom redirect rules** – Define sites to redirect from and their
destination. A default set is included (e.g. `youtube.com` → `nebula.tv`).
- **Whitelisting** – Domains added to the whitelist bypass redirects entirely.
- **Privacy mode** – Store all data locally instead of syncing via Chrome when
you prefer not to sync settings.
- **Incognito handling** – Redirects can be disabled or have separate rules in
incognito windows.
- **Import/Export** – Backup your rules to a JSON file or restore them later.
- **Loop prevention and validation** – URLs are sanitized and checked against an
allowed destination list to avoid unsafe or infinite redirects.

## How It Works

On installation the background service worker loads your rules from storage (or
a default set if none exist) and builds dynamic redirect rules. When you visit a
matching source domain, the extension redirects the request to the destination
site. Changes you make in the popup are persisted using `chrome.storage` and
cause the rules to be rebuilt. A small cache avoids repeated work and periodic
cleanup keeps data fresh.

## Usage

Clone this repository and load it as an unpacked extension in your Chromium
browser's extensions page. Use the extension's popup to add or edit redirect
rules and manage privacy and security options.

The repository also includes `icon-helper.html`, a small tool for generating the
extension icon in different sizes.
