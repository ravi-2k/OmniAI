import { setupServer } from "msw/node";

// Each test registers the endpoints it needs; unhandled requests fail the test.
export const server = setupServer();
