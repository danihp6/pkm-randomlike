export const ENVIRONMENT: string = import.meta.env.ENVIRONMENT ?? '';

/** True only for a `vite dev` build, which loads `.env.development`. */
export const IS_DEVELOP: boolean = ENVIRONMENT === 'develop';

/** The key that shows or hides the dev debug menu (see `src/dev/debugMenu.ts`). */
export const DEBUG_MENU_TOGGLE_KEY = 'E';
