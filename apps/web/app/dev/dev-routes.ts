/**
 * The developer fixture pages under /dev (decision 0137): the component library at /dev/ui.
 * They show no data and need no session, but they are not for the public: a production build
 * answers 404 unless DEV_UI_ROUTES is exactly "on" (the browser tests, a review deploy).
 */
export const devRoutesEnabled = (env: Readonly<Record<string, string | undefined>>): boolean =>
  env.NODE_ENV !== "production" || env.DEV_UI_ROUTES === "on";
