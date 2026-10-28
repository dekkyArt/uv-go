import { domMax } from 'motion/react';

/**
 * `animate` rides with the lazy features: imported statically it would add about 18 KB gzip to
 * the initial JS of `/` (the hour strip's intro scroll is its only user).
 */
export { animate } from 'motion/react';

export default domMax;
