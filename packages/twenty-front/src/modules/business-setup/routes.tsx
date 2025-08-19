import { BusinessSetupWelcome } from '~/pages/business-setup/BusinessSetupWelcome';
import { AppPath } from '@/types/AppPath';
import { Route } from 'react-router-dom';

export const BusinessSetupRoutes = () => (
  <>
    <Route
      path={AppPath.BusinessSetupWelcome}
      element={<BusinessSetupWelcome />}
    />
    {/* Другие маршруты будут добавлены позже */}
  </>
);
