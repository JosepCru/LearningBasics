import { HashRouter, Route, Routes } from 'react-router';
import { AccountPage } from '../features/account/AccountPage';
import { LessonPage } from '../features/lessons/LessonPage';
import { TopicPage } from '../features/lessons/TopicPage';
import { PracticePage } from '../features/practice/PracticePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { HomePage } from '../features/subjects/HomePage';
import { SubjectPage } from '../features/subjects/SubjectPage';
import { NotFoundPage } from '../ui/NotFoundPage';
import { Layout } from './Layout';

/**
 * HashRouter: GitHub Pages no reescribe rutas, así que la ruta va tras "#".
 * Recargar o abrir un enlace directo siempre funciona. Ver docs/DECISIONS.md D-002.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="subjects/:subjectId" element={<SubjectPage />} />
          <Route path="topics/:topicId" element={<TopicPage />} />
          <Route path="lessons/:lessonId" element={<LessonPage />} />
          <Route path="practice/:topicId" element={<PracticePage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
