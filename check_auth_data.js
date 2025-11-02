const fs = require('fs');

console.log('🔍 Проверка данных авторизации Telegram...');

// Проверяем accounts.json
console.log('\n1️⃣ Проверка accounts.json:');
try {
  const accountsData = fs.readFileSync('./accounts.json', 'utf8');
  const accounts = JSON.parse(accountsData);
  console.log('   Содержимое accounts.json:', accounts);
  console.log('   Количество аккаунтов:', accounts.length);
} catch (error) {
  console.log('   ❌ Ошибка чтения accounts.json:', error.message);
}

// Проверяем другие файлы сессий
console.log('\n2️⃣ Проверка файлов сессий:');
const sessionFiles = [
  'string_session.txt',
  'tdata_js_session.txt'
];

sessionFiles.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      console.log(`   ${file}: ${content.length} символов`);
      if (content.length > 0) {
        console.log(`   Первые 50 символов: ${content.substring(0, 50)}`);
      }
    } else {
      console.log(`   ${file}: файл не существует`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка чтения ${file}:`, error.message);
  }
});

// Проверяем папку temp_sessions
console.log('\n3️⃣ Проверка папки temp_sessions:');
try {
  if (fs.existsSync('./temp_sessions')) {
    const files = fs.readdirSync('./temp_sessions');
    console.log('   Файлы в temp_sessions:', files);
  } else {
    console.log('   Папка temp_sessions не существует');
  }
} catch (error) {
  console.log('   ❌ Ошибка чтения temp_sessions:', error.message);
}

console.log('\n📋 Рекомендации:');
console.log('1. Данные авторизации должны сохраняться в localStorage на фронтенде');
console.log('2. Проверьте браузер на наличие telegramSessionString в localStorage');
console.log('3. Если данные есть в localStorage, но парсинг не работает - проблема в передаче данных на бэкенд');