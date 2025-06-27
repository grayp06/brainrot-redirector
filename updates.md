# Updates

This repository hosts the **Smart Site Redirector** Chrome extension. The following summarizes its security considerations and recommended improvements.

## Security Implications
- **Broad URL access**: The extension requests `"<all_urls>"` host permission, letting it see every URL visited. Necessary for redirect functionality but risky if the extension is compromised.
- **Potential for malicious imports**: Large or crafted JSON imports could overload storage or performance despite validation.
- **Storage synchronization exposure**: Rules sync through Chrome Sync unless privacy mode is enabled. Anyone with access to the user's Google account could see or alter them.
- **Rule manipulation**: Attackers with access to stored settings could modify redirects to malicious destinations. Allowed destination whitelist mitigates but relies on a hardcoded list.

## Suggested Improvements
- **Limit host permissions**: Reduce permissions from `"<all_urls>"` to specific domains in redirect rules or let users add them explicitly.
- **Harden import/export**: Enforce a maximum number of rules and check JSON size before parsing to avoid storage or performance issues.
- **Protect rule storage**: Use versioning or checksums, and consider encrypting rules in sync storage to detect or prevent unauthorized changes.
- **Maintain an audit log**: Keep a small local log of rule changes or imports to help identify unauthorized modifications.
- **Disable console logging in production**: Remove or restrict verbose logging to reduce leak risks.
- **Schedule regular security reviews**: Periodically reassess the whitelist, sanitization logic, and CSP to ensure no new vulnerabilities are introduced.
