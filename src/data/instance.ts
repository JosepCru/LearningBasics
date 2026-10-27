import { LearningDB } from './db';

/** Instancia única de la app. Los tests crean la suya con un nombre propio. */
export const db = new LearningDB();
