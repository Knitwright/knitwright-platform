/** The parsed JSON body of a response, or null when the body is not JSON. Never throws. */
export const readJson = (response: Response): Promise<unknown> => response.json().catch(() => null);
