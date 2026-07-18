---
name: verify
summary: Verify the museum landing and deferred Three.js entry in a real browser.
---

# Museum browser verification

1. Start the app on an unused port: `PORT=4173 npm run run`.
2. Open it with `npx -y agent-browser@latest --session museum-verify open http://127.0.0.1:4173/`.
3. Before entry, verify `#landing` exists, no `canvas` exists, and `scrollWidth === clientWidth` at desktop and mobile widths.
4. Click the sheet reveal, scroll through `#quy-trinh`, then click `[data-enter-museum]`.
5. Wait for `document.querySelector('canvas') && !document.querySelector('#landing')`; capture screenshots and browser console output.

Use an alternate port when 3000 is occupied. Three.js deprecation/FBX skin-weight warnings are known runtime noise; failures or uncaught errors are not.
