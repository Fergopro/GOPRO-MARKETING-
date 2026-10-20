# GoProcures — Production Readiness & Procurement Automation
Date: 2026-10-20. Branch: goprocures-ai. Do not merge before end-to-end approval.

## Applied to existing Supabase
- Legacy users, payments, confirmations, suppliers, supplier_messages now use admin-only RLS; anon access revoked. Legacy user password column not granted to authenticated clients.
- Customer requests INSERT/UPDATE grants limited to intake and confirmation fields, excluding status, payments and administration fields.
- Quote status constraint accepts published.
- Quote document policies corrected, existing administrator quote-upload path preserved.
- Anonymous uploads to legacy public attachments blocked; public reads maintained temporarily because existing records link to public files.
- Browser request store now relies on server-default request status rather than setting it.

## Remaining release blockers
- Signed-in live tests of voice/text request confirmation, attachments, dashboard and account isolation.
- Real admin quote create, upload, publish and client approve/reject cycle.
- Free trial, Pro voice, usage tracking, rate limits and billing enforcement under actual concurrent use.
- Legacy public attachments migration to private signed URLs, keeping links working.
- Legacy stored password review and credential reset/rotation plan.
- Review Vercel production environment, branch, deployment, logs and rollback; project connector currently returns 403.
- Testimonials: no approved entries at audit time; render honest empty state.

## Scalable procurement automation architecture
1. Intake: standardized GP-INTEL brief, exact technical specs, quote-to-beat, units, quantity, destination, product documents, structured follow-ups.
2. Async sourcing: independently verified manufacturers/distributors, evidence and dates, supplier ratings, geographic sourcing decisions.
3. RFQ: normalized specification, admin-approval-gated outbound messages, email threading, reminders and structured supplier quotes.
4. Quote intelligence: commercial/technical equivalence, flagged deviations, taxes, Incoterms, freight, duties, total landed cost and cost breakdown.
5. Decisions: immutable audit log and explicit administrator/client approval before external communications, POs, payments or supplier disclosure.
6. Fulfilment: supplier contract, purchase order, customs, logistics milestones, proof of delivery, invoicing and disputes.
7. Commercial system: fee agreements, savings verification, Pro plans, AI usage limits, cost controls, subscriptions and tenant isolation.
8. Reliability: asynchronous jobs, retries, idempotency, alerts, back-up and recovery, security logging, client analytics and operational KPIs.

Never call supplier or payment automation implemented without proof of connected tools and tested execution.