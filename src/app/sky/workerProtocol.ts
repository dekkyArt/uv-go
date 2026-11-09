import type { SkyUniforms } from '../../domain/skyUniforms';

export type SkyCommand =
  | {
      type: 'init';
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      hidden: boolean;
      reducedMotion: boolean;
    }
  | { type: 'target'; uniforms: SkyUniforms }
  | { type: 'cap'; value: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'start' }
  | { type: 'stop' };

export type SkyReply = { type: 'ready' | 'started' | 'lost' | 'failed' };
