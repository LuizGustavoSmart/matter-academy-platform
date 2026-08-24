import branca from '../assets/cronograma/faixa-branca.png.asset.json';
import verde from '../assets/cronograma/faixa-verde.png.asset.json';
import marrom from '../assets/cronograma/faixa-marrom.png.asset.json';
import preta from '../assets/cronograma/faixa-preta.png.asset.json';

/**
 * Artes oficiais de graduação usadas EXCLUSIVAMENTE nos blocos de faixa do
 * cronograma. Não interfere nas capas de cursos/aulas (bucket `capas`).
 */
export const FAIXA_CRONOGRAMA_IMG: Record<string, string> = {
  branca: branca.url,
  verde: verde.url,
  marrom: marrom.url,
  preta: preta.url,
};
