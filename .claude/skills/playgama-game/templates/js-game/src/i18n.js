// English is the default and fallback (3.4.1). Language comes ONLY from platform.language (3.4.2).
// Every language declared in the publication form must have EVERY key here (3.4.3).
const DICT = {
  en: { play: 'Play', again: 'Play again', resume: 'Resume', paused: 'Paused', over: 'Game over', score: 'Score', best: 'Best', lives: 'Lives', revive: 'Watch ad: +1 life', sound: 'Sound', tutorial: 'Catch the falling dots. Move with arrows / A D, or drag.' },
  ru: { play: 'Играть', again: 'Ещё раз', resume: 'Продолжить', paused: 'Пауза', over: 'Игра окончена', score: 'Счёт', best: 'Рекорд', lives: 'Жизни', revive: 'Реклама: +1 жизнь', sound: 'Звук', tutorial: 'Лови падающие шарики. Двигайся стрелками / A D или пальцем.' },
  es: { play: 'Jugar', again: 'Jugar otra vez', resume: 'Continuar', paused: 'Pausa', over: 'Fin del juego', score: 'Puntos', best: 'Récord', lives: 'Vidas', revive: 'Anuncio: +1 vida', sound: 'Sonido', tutorial: 'Atrapa los puntos que caen. Muévete con flechas / A D o arrastrando.' },
  de: { play: 'Spielen', again: 'Nochmal', resume: 'Weiter', paused: 'Pause', over: 'Spiel vorbei', score: 'Punkte', best: 'Rekord', lives: 'Leben', revive: 'Werbung: +1 Leben', sound: 'Ton', tutorial: 'Fange die fallenden Punkte. Bewege dich mit Pfeilen / A D oder ziehen.' },
  fr: { play: 'Jouer', again: 'Rejouer', resume: 'Reprendre', paused: 'Pause', over: 'Partie terminée', score: 'Score', best: 'Record', lives: 'Vies', revive: 'Pub : +1 vie', sound: 'Son', tutorial: 'Attrape les points qui tombent. Déplace-toi avec les flèches / A D ou glisse.' },
  pt: { play: 'Jogar', again: 'Jogar de novo', resume: 'Continuar', paused: 'Pausa', over: 'Fim de jogo', score: 'Pontos', best: 'Recorde', lives: 'Vidas', revive: 'Anúncio: +1 vida', sound: 'Som', tutorial: 'Pegue os pontos que caem. Mova com setas / A D ou arrastando.' },
  tr: { play: 'Oyna', again: 'Tekrar oyna', resume: 'Devam', paused: 'Duraklatıldı', over: 'Oyun bitti', score: 'Skor', best: 'En iyi', lives: 'Can', revive: 'Reklam: +1 can', sound: 'Ses', tutorial: 'Düşen noktaları yakala. Oklar / A D ile ya da sürükleyerek hareket et.' },
};

let lang = 'en';
export const languages = () => Object.keys(DICT);
export function setLang(code) { lang = DICT[code] ? code : 'en'; }
export const getLang = () => lang;
export const t = (key) => (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
