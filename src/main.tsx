import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './hooks/useTheme';
import { WeightUnitProvider } from './hooks/useWeightUnit';
import { AuthProvider } from './hooks/useAuth';
import { CoachProvider } from './hooks/useCoach';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <WeightUnitProvider>
            <AuthProvider>
              <CoachProvider>
                <App />
              </CoachProvider>
            </AuthProvider>
          </WeightUnitProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
