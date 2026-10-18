# U06 — Studio Pop real public projector

Rebuild the actual #/stage presentation using public-scene kinds only. New full-screen navy game-show frame, responsive phase indicator, yellow reveal, stage motif, explicit waiting/paused/disconnected labels, five-game board/hint/wall/survey treatments, and ranked public score display. All scores and rank calculations use only PublicStageScene.visibleScores; bars never imply unseen points or permission.

The original StageViewer BroadcastChannel protocol, strict public DTO allowlist, no IndexedDB/host identity on projector, explicit host publication, stale/conflict blanking, session IDs, engines, timers, backups and G26 NO_GO stay unchanged. No host UI/gameplay redesign. The G15 archived visual baselines and existing tests remain immutable, and U06 captures new non-golden screenshots separately.

Validation: new phase and score Vitest; real browser host-to-projector publish/reveal with unpublished answers hidden, 1280×720/mobile 375px overflow and reduced-motion, original G15 privacy/screenshots, offline installed PWA, TypeScript/lint/Vite. Physical projector and human release approvals remain pending.
