/**
 * A canvas page: the one canvas at `/project/<id>` (decision 0145), and the pages still under a design or a launch canvas (decision 0138).
 *
 * They fill the window with their own panels, and `10` §4 gives the editor its own chrome with no
 * dashboard rail and a 1280 px minimum. So on a canvas the shell draws no rail and no help bubble (the
 * bubble would cover the canvas's corner); the top bar's Menu holds every place instead, at every width.
 */
const CANVAS = /^\/(studio|launch|project)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

export const isCanvas = (path: string): boolean => CANVAS.test(path);

export const showsHelpBubble = (path: string): boolean => !isCanvas(path);
