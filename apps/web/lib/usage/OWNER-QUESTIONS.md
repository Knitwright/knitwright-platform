# Owner questions: usage metering (plan step 10)

1. **Allowance amounts.** The defaults below are provisional, chosen only to be above one
   design session at mid-tier prices (plan cost table: about $0.17). Set the real ones with
   the `USAGE_*` variables (microdollars; 1,000,000 = $1) or per user or brand with
   `usage_set_limit`.

   | Allowance, per UTC day | Default |
   |---|---|
   | User, text and image reading (`ai`) | $0.25 |
   | Brand, `ai` | $1.00 |
   | User, photoreal images | $0.50 |
   | Brand, photoreal images | $2.00 |
   | Safety ceiling, everyone together | $25.00 |

2. **Alert channel.** At half and at full ceiling a warning is written to the server log.
   No email provider is set up yet. Where should the alert go (email via Resend, Sentry)?
3. **Day or month.** Allowances reset at midnight UTC every day. Is a monthly allowance
   wanted once pricing exists?
4. **Per-call cost estimates** are set by steps 12 to 14, when the models are chosen.
