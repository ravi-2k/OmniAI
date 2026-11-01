import { HttpError } from "../../../shared/http/errors.js";

// Agents let known errors (rate limits, validation) through untouched and turn
// anything unexpected into a safe 502, logging the real cause server-side.
export const toAgentError = (error, message) => {
  if (error instanceof HttpError) return error;
  if (error?.cause instanceof HttpError) return error.cause;

  console.error(error);
  return new HttpError(502, "AGENT_FAILED", message);
};
