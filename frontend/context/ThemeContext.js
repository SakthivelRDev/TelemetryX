'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BASE_MAP_STYLES, getSavedMapStyle, mapStyleForNavTheme, saveMapStyle } from '../lib/mapTheme';

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  mapStyle: 'dark',
  setMapStyle: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme]       = useState('dark');
  const [mapStyle, setMapStyleState] = useState('dark');
  useEffect(() => {
    const savedTheme = localStorage.getItem('app360_theme') || 'dark';
    const savedMap   = getSavedMapStyle();
    setTheme(savedTheme);
    setMapStyleState(mapStyleForNavTheme(savedTheme, savedMap));
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const setMapStyle = useCallback((style) => {
    setMapStyleState(style);
    saveMapStyle(style);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app360_theme', next);
      document.documentElement.setAttribute('data-theme', next);

      const savedMap = getSavedMapStyle();
      if (BASE_MAP_STYLES.includes(savedMap)) {
        const synced = next === 'light' ? 'light' : 'dark';
        setMapStyleState(synced);
        saveMapStyle(synced);
      }

      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mapStyle, setMapStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
