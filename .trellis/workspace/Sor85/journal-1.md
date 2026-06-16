# Journal - Sor85 (Part 1)

> AI development session journal
> Started: 2026-06-14

---



## Session 1: 修复多机器人头像折叠动画与 Chrome 切换卡死

**Date**: 2026-06-16
**Task**: 修复多机器人头像折叠动画与 Chrome 切换卡死
**Branch**: `codex/multi-onebot-capsule-switch`

### Summary

Fix multi-bot capsule fold/expand FLIP artifacts and Chrome click-to-switch freeze

### Main Changes

### Summary

Fixed multi-bot capsule avatar fold/expand animation artifacts and a Chrome-only click-to-switch animation freeze.

### Main Changes

- **Fold/expand ghost artifacts (6+ avatars)**: The collapsed "extra" avatars and the `+N` overflow badge were hidden with `visibility: hidden`. anime.js v4 `createLayout` only treats `display:none`/`visibility:hidden` as "removed" (`measuredIsVisible` ignores opacity), so on every record/animate cycle those nodes were flagged entering/leaving, force-shown, and excluded from the ancestor-compensating FLIP translate — leaving them pinned to a recorded relative position while the right-anchored stack collapsed, dragging them across the active (rightmost) bot avatar. Switched both to opacity-only hiding (`client/styles/capsule.scss`) so they stay full FLIP participants and fade in place, never crossing the active avatar. Added `aria-hidden`/`tabindex="-1"` gating (`isBotCollapsedHidden`) to keep the now-opacity-hidden buttons out of the tab order and screen-reader tree.
- **Lost slide motion after the ghost fix**: Extra avatars were already spread (`index*24`) while collapsed, so real travel was only ~21-35px — once the (buggy) sweep was gone it looked like a pure fade. Reworked `getBotSwitchStyle` to tuck extras behind the visible stack when collapsed (`(visibleCount-1)*24`), restoring 45/76/107px of slide while keeping both endpoints left of the active avatar.
- **Chrome click-to-switch freeze**: Chrome focuses a `<button>` on click (Firefox/macOS Safari do not). `selectBot` reorders the keyed `v-for`, moving the focused button to index 0, which fires a `relatedTarget=null` `focusout` on the capsule. The old `@focusout="collapseBotStack"` then ran a second `record()/animate()` that cancelled the in-flight switch FLIP (`record()` calls `timeline.cancel()`) and set `botStackExpanded=false`, freezing the avatar in place and blocking later `pointerleave` collapse. Replaced direct pointerleave/focusout collapse with explicit hover/focus tracking (`botStackHovered`/`botStackFocused` → `syncBotStackExpanded`), and bracketed the `selectBot` reorder with a `suppressStackCollapse` flag that lifts after the 260ms switch FLIP settles, re-deriving focus from `document.activeElement`.

### Testing

- [OK] `yarn typecheck` (vue-tsc) — exit 0
- [OK] `yarn test` (vitest) — 338 passed
- [OK] `yarn build` (tsup + vite) — exit 0

### Status

[OK] **Completed**

### Notes

- `ARCHITECTURE.md` appeared deleted in the working tree at this session but was NOT touched by this work; excluded from all commits, left for the developer to review/restore.

### Next Steps

- Manual cross-browser hover/click verification at 5/6/7/9 avatars in Chrome, Firefox, and Safari.


### Git Commits

| Hash | Message |
|------|---------|
| `1e94206` | (see git log) |
| `a103bf2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
