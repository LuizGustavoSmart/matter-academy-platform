import { createContext, useContext } from 'react';
import type { PublicMotionMode } from '../types';

export type PublicMotionContextValue = {
  /** Modo da cena/experiência: full, lite ou static. */
  mode: PublicMotionMode;
  /** true quando o usuário prefere movimento reduzido. */
  reduceMotion: boolean;
};

export const PublicMotionContext = createContext<PublicMotionContextValue>({
  mode: 'static',
  reduceMotion: false,
});

export function usePublicMotion() {
  return useContext(PublicMotionContext);
}
