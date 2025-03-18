import db from '../db';

interface Settings {
  inflationRate: number;
  alternativeLendingRate: number;
  businessGrowthRate: number;
  lmStudioSettings: {
    baseUrl: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
  };
}

const DEFAULT_SETTINGS: Settings = {
  inflationRate: 6.0,
  alternativeLendingRate: 12.0,
  businessGrowthRate: 15.0,
  lmStudioSettings: {
    baseUrl: 'http://localhost:1234/v1',
    modelName: 'gemma-3-1b-it',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: true
  }
};

export const getSettings = async (): Promise<Settings> => {
  try {
    const dbInstance = await db.init();
    
    // Create settings table if it doesn't exist
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all settings
    const result = dbInstance.exec('SELECT key, value FROM settings');
    
    if (!result.length) {
      return DEFAULT_SETTINGS;
    }

    const settings: Partial<Settings> = { ...DEFAULT_SETTINGS };
    result[0].values.forEach(([key, value]: [string, string]) => {
      try {
        if (key === 'lmStudioSettings') {
          settings.lmStudioSettings = JSON.parse(value);
        } else if (key === 'inflationRate') {
          settings.inflationRate = parseFloat(value);
        } else if (key === 'alternativeLendingRate') {
          settings.alternativeLendingRate = parseFloat(value);
        } else if (key === 'businessGrowthRate') {
          settings.businessGrowthRate = parseFloat(value);
        }
      } catch (parseError) {
        console.warn(`Failed to parse setting ${key}:`, parseError);
        // Keep default value for this setting
      }
    });

    return {
      ...DEFAULT_SETTINGS,
      ...settings
    } as Settings;
  } catch (error) {
    console.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const updateSettings = async (newSettings: Settings): Promise<void> => {
  try {
    const dbInstance = await db.init();
    
    // Start transaction
    dbInstance.run('BEGIN TRANSACTION');

    try {
      // Update each setting
      for (const [key, value] of Object.entries(newSettings)) {
        let valueToStore: string;
        
        // Convert objects to JSON strings before storing
        if (typeof value === 'object' && value !== null) {
          valueToStore = JSON.stringify(value);
        } else {
          valueToStore = String(value);
        }
        
        dbInstance.run(`
          INSERT OR REPLACE INTO settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `, [key, valueToStore]);
      }

      dbInstance.run('COMMIT');
      db.save();
    } catch (error) {
      dbInstance.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
};
