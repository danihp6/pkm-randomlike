export const ENVIRONMENT: string = import.meta.env.ENVIRONMENT ?? '';

/** True only for a `vite dev` build, which loads `.env.development`. */
export const IS_DEVELOP: boolean = ENVIRONMENT === 'develop';
