const fs = require('fs');
const path = require('path');

// Путь к файлу настроек
const SETTINGS_FILE = path.join(__dirname, 'persistent-settings.json');

// Функция для загрузки настроек из файла
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      console.log('✅ Настройки загружены из файла:', {
        hasApiKey: !!settings.openrouterApiKey,
        hasCriteria: !!settings.leadCriteria,
        hasSheets: !!settings.sheetsConfig,
        hasSpreadsheetId: !!settings.spreadsheetId
      });
      return settings;
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки настроек:', error.message);
  }
  
  // Возвращаем пустые настройки если файл не существует или поврежден
  return {
    sheetsConfig: null,
    spreadsheetId: null,
    openrouterApiKey: null,
    leadCriteria: null
  };
}

// Функция для сохранения настроек в файл
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('✅ Настройки сохранены в файл:', {
      hasApiKey: !!settings.openrouterApiKey,
      hasCriteria: !!settings.leadCriteria,
      hasSheets: !!settings.sheetsConfig,
      hasSpreadsheetId: !!settings.spreadsheetId
    });
    return true;
  } catch (error) {
    console.error('❌ Ошибка сохранения настроек:', error.message);
    return false;
  }
}

// Тестируем функции
console.log('🧪 Тестируем сохранение и загрузку настроек...');

// Создаем тестовые настройки
const testSettings = {
  sheetsConfig: { test: 'data' },
  spreadsheetId: 'test-spreadsheet-id',
  openrouterApiKey: 'test-api-key',
  leadCriteria: 'Ищем клиентов для веб-разработки'
};

// Сохраняем тестовые настройки
console.log('💾 Сохраняем тестовые настройки...');
const saveResult = saveSettings(testSettings);

if (saveResult) {
  // Загружаем настройки обратно
  console.log('📂 Загружаем настройки из файла...');
  const loadedSettings = loadSettings();
  
  // Проверяем что настройки загрузились правильно
  const isValid = loadedSettings.openrouterApiKey === testSettings.openrouterApiKey &&
                  loadedSettings.leadCriteria === testSettings.leadCriteria &&
                  loadedSettings.spreadsheetId === testSettings.spreadsheetId;
  
  if (isValid) {
    console.log('✅ Тест прошел успешно! Настройки сохраняются и загружаются корректно.');
  } else {
    console.log('❌ Тест не прошел! Загруженные настройки не совпадают с сохраненными.');
  }
} else {
  console.log('❌ Не удалось сохранить настройки для тестирования.');
}

module.exports = {
  loadSettings,
  saveSettings,
  SETTINGS_FILE
};