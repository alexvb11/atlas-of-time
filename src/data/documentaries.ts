// Documentary films: chapters (journeys from journeys.ts) played back to back with narration, the
// interface hidden and the camera flying between places. Every caption is a journey stop, with
// its date and article, so the films say nothing the journeys do not.
export type Documentary = { id: string; title: string; blurb: string; chapters: string[] }

export const DOCUMENTARIES: Documentary[] = [
  {
    id: 'rome',
    title: 'Rise and fall of Rome',
    blurb: 'Hannibal’s war against Rome, then six centuries of decline to the last emperors.',
    chapters: ['hannibal', 'fall-of-rome'],
  },
  {
    id: 'connected',
    title: 'Connecting the world',
    blurb: 'The Silk Road, Marco Polo, Ibn Battuta, Columbus and the first voyage around the world.',
    chapters: ['silk-road', 'marco-polo', 'ibn-battuta', 'columbus', 'magellan'],
  },
  {
    id: 'conquest',
    title: 'Conquerors',
    blurb: 'Alexander, the Mongols, Napoleon in Russia and the Second World War.',
    chapters: ['alexander', 'mongols', 'napoleon-1812', 'ww2'],
  },
]
