/**
 * Where the help bubble is drawn (decision 0138). Not over a canvas: the design editor and the launch
 * canvas fill the window with their own panels, whose corner the bubble would cover, and `08` §5 gives
 * the editor its own chrome. Every other signed-in page has it.
 */
const CANVAS = /^\/(studio|launch)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

export const showsHelpBubble = (path: string): boolean => !CANVAS.test(path);
