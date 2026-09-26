import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './hooks/useTheme';
import { DesignProvider } from './hooks/useDesign';
import { WeightUnitProvider } from './hooks/useWeightUnit';
import { AuthProvider } from './hooks/useAuth';
import { CoachProvider } from './hooks/useCoach';
// Anton (poster headings) is bundled, not pulled from Google Fonts, so the
// Dojo Poster look never falls back to a system face.
import '@fontsource/anton/400.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DesignProvider>
            <WeightUnitProvider>
              <AuthProvider>
                <CoachProvider>
                  <App />
                </CoachProvider>
              </AuthProvider>
            </WeightUnitProvider>
          </DesignProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
