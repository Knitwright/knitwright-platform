# 0002: Function time limit on the host

Status: Open
Date: 2026-09-29
Plan step: 1, task 6

## Context

Tech pack exports and image generation can take tens of seconds. The plan assumes a
function time limit of about 300 seconds on Vercel and asks for the real limit to be
confirmed on a deployment and recorded here.

## Decision

None yet. No deployment exists: creating the repository and the hosted project needs the
owner to log in (owner action A1 and a Vercel login).

Until it is measured, code is written to the stricter assumption: no request handler
relies on more than 60 seconds, and work that may take longer uses `after()` with a status
row the browser polls.

## Evidence

None yet. To record: the plan the project is on, the configured `maxDuration`, and the
result of a handler that sleeps past the limit on a preview deployment.

## Consequences

If the measured limit is lower than 60 seconds, exports (step 9) and image jobs (step 14)
need to be re-checked against it.
