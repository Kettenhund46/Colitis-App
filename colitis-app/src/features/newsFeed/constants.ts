export const FEED_URL = 'https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json';
export const FEED_CLIENT_TIMEOUT_MS = 15000;

/**
 * Was der Bildschirm zeigt, wenn unter der hinterlegten Adresse nichts liegt.
 *
 * Der Feed ist in der App vollstaendig gebaut, aber nie veroeffentlicht
 * worden: Der Erzeuger unter feed-service/ lief nie, das Ziel-Repository gibt
 * es nicht. Ein technischer Fehlertext wuerde eine voruebergehende Stoerung
 * nahelegen -- das hier ist ein Dauerzustand und gehoert so benannt.
 */
export const FEED_NOT_PUBLISHED_TEXT =
  'Der Nachrichten-Feed ist noch nicht in Betrieb. Die App kann ihn lesen, aber unter der hinterlegten Adresse wird bisher nichts veröffentlicht.';

export const FEED_OFFLINE_TEXT = 'Offline — zeigt zuletzt geladene Neuigkeiten';

export const FEED_LOAD_ERROR_TEXT = 'Neuigkeiten konnten nicht geladen werden.';
