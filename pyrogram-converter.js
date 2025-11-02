const FdyConvertor = require('fdy-convertor');
const fs = require('fs');
const path = require('path');

/**
 * Конвертер Pyrogram сессий в gramJS StringSession
 */
class PyrogramConverter {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp_sessions');
    this.ensureTempDir();
  }

  /**
   * Создает временную директорию для сессий
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Конвертирует Pyrogram .session файл в gramJS StringSession
   * @param {string} sessionFilePath - Путь к .session файлу
   * @param {string} apiId - API ID
   * @param {string} apiHash - API Hash
   * @returns {Promise<string>} - StringSession
   */
  async convertPyrogramSession(sessionFilePath, apiId, apiHash) {
    try {
      console.log('Конвертация Pyrogram сессии:', sessionFilePath);

      // Проверяем существование файла
      if (!fs.existsSync(sessionFilePath)) {
        throw new Error(`Файл сессии не найден: ${sessionFilePath}`);
      }

      // Копируем файл во временную директорию
      const fileName = path.basename(sessionFilePath);
      const tempFilePath = path.join(this.tempDir, fileName);
      fs.copyFileSync(sessionFilePath, tempFilePath);

      // Настройки конвертера
      const options = {
        path: this.tempDir,
        savePath: this.tempDir,
        fileExt: 'session',
        prefix: 'converted_'
      };

      const converter = new FdyConvertor(options);

      // Конвертируем сессию
      await converter.convert([fileName]);

      // Сохраняем с API параметрами
      const { new: newFiles } = converter.save({ 
        apiId: apiId, 
        apiHash: apiHash 
      });

      if (newFiles.length === 0) {
        throw new Error('Не удалось сконвертировать сессию');
      }

      // Читаем сконвертированную StringSession
      const convertedFilePath = path.join(this.tempDir, newFiles[0]);
      const stringSession = fs.readFileSync(convertedFilePath, 'utf8').trim();

      // Очищаем временные файлы
      this.cleanup();

      console.log('Сессия успешно сконвертирована');
      return stringSession;

    } catch (error) {
      console.error('Ошибка конвертации Pyrogram сессии:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Очищает временные файлы
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.tempDir, file));
        });
        fs.rmdirSync(this.tempDir);
      }
    } catch (error) {
      console.warn('Предупреждение: не удалось очистить временные файлы:', error.message);
    }
  }

  /**
   * Проверяет, является ли файл Pyrogram сессией
   * @param {string} filePath - Путь к файлу
   * @returns {boolean}
   */
  static isPyrogramSession(filePath) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.session') {
      return false;
    }

    try {
      // Pyrogram сессии - это SQLite файлы
      const buffer = fs.readFileSync(filePath, { encoding: null });
      const header = buffer.slice(0, 16).toString('ascii');
      return header.includes('SQLite');
    } catch (error) {
      return false;
    }
  }
}

module.exports = PyrogramConverter;