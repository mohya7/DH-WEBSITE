# Branch layout

- **`release/v1`** is the deployable branch. Frozen except for hotfixes.
- **`feature/interviewer-portal`** is where Phase 1 and Phase 2 live.

They diverged deliberately. `release/v1` carries cherry-picked, interviewer-stripped versions of fixes that originated on the feature branch (static allow-list, session purge on password change, `adminView` deny-by-default, required `normalizeAccountRole`).

**Do not merge `release/v1` into `feature/interviewer-portal`.** That merge hits five conflicts in `server.js`, and taking release’s side is a regression in each case (it would drop `book/`, the interviewer role, and `createManagedAccount`).

Reconcile the other direction: merge the feature branch into `release/v1` when the interviewer portal ships.
