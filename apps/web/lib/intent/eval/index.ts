export { baselineObserver, baselineReading } from "./baseline";
export { COLOUR_TOLERANCE, deltaE, extractColours, matchColours } from "./colours";
export { BudgetExhausted, INTAKE_SYSTEM, intakeObserver, parseIntakeReply, reserveFor } from "./live";
export { createOracleProvider } from "./oracle";
export { formatReport } from "./report";
export { runEvaluation, type EvalRun } from "./run";
export { scoreCase, summarise, type CaseScore, type Summary } from "./score";
export { ARTICLE_TARGET, LATENCY_BUDGET_MS, fixtureSchema, type EvalCase, type Observation, type Observer, type Prediction } from "./schema";
