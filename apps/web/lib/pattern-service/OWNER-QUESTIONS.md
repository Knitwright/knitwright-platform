# Owner questions: pattern service (plan v4, W4-A)

The full list, with what was built, is in `docs/decisions/0060-pattern-service.md`. In short:

1. Price of a request in credits (setting `pattern_service.price_credits`, empty until set; nothing is charged while empty).
2. Whether the credits come back when the design is ordered (built: no).
3. Turnaround in working days (setting `pattern_service.turnaround_working_days`, empty until set).
4. Refund on decline (built: yes) and asking again after a decline (built: only with a new design version).
5. The technician who reviews returned patterns.
6. Email to the Sialkot team on a new request, once a mailer is chosen.
