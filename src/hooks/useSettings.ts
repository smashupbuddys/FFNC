import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../lib/db/settings';

export const useSettings = () => {
  const [settings, setSettings] = useState({
    inflationRate: 6.0,
    alternativeLendingRate: 12.0,
    businessGrowthRate: 15.0,
    lmStudioSettings: {
      baseUrl: 'http://localhost:1234/v1',
      modelName: 'local-model',
      temperature: 0.7,
      maxTokens: 2000,
      enabled: false
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await getSettings();
      setSettings({
        ...savedSettings,
        lmStudioSettings: {
          ...settings.lmStudioSettings,
          ...savedSettings.lmStudioSettings
        }
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await updateSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    saveSettings
  };
};
