# INCIDENT RESPONSE PLAN: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  

---

## 1. Incident Severity Definitions

- **SEV-1 (Critical):** SSRF vulnerability discovered, unauthenticated command injection, or widespread infrastructure compromise.
- **SEV-2 (High):** Extractor down globally; 100% of video resolutions failing.
- **SEV-3 (Medium):** Rate limit misconfiguration causing false-positive 429 rejections for valid users.
- **SEV-4 (Low):** Minor UI formatting or non-breaking metadata truncation.

---

## 2. SEV-1 Response Procedure (Immediate Containment)

1. **Service Suspension:** Stop the resolver container immediately:
   ```bash
   docker compose down
   ```
2. **Audit Network Traffic:** Inspect reverse proxy access logs to identify attacker source IP and payload patterns.
3. **Patch & Validate:** Apply code mitigation, verify SSRF and input validation test suites locally:
   ```bash
   .\backend\.venv\Scripts\pytest -v backend\tests
   ```
4. **Deploy Hotfix:** Rebuild and redeploy with verified non-root, read-only filesystem containers.
