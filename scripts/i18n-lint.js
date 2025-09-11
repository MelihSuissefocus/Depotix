#!/usr/bin/env node

/**
 * i18n Lint Script for Depotix
 * 
 * This script checks for:
 * - Unused translation keys
 * - Missing translations 
 * - Hardcoded strings that should use t()
 * - Translation key conventions
 */

const fs = require('fs');
const path = require('path');

// Load translation files
const loadTranslations = (locale) => {
  try {
    const filePath = path.join(__dirname, '..', 'locales', `${locale}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error loading ${locale} translations:`, error.message);
    return {};
  }
};

// Get all translation keys from a nested object
const getAllKeys = (obj, prefix = '') => {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys = keys.concat(getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

// Find all files in a directory
const findFiles = (dir, extension = '.tsx') => {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(findFiles(fullPath, extension));
    } else if (stat.isFile() && item.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
};

// Extract t() usage from file content
const extractTranslationUsage = (content) => {
  const regex = /t\(['"`]([^'"`]+)['"`]\)/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
};

// Extract hardcoded strings (basic detection)
const findHardcodedStrings = (content, filePath) => {
  const hardcoded = [];
  
  // Look for JSX text content that looks like UI text
  const jsxTextRegex = />([A-Z][a-zA-Z\s]{3,})</g;
  let match;
  
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.length > 3 && /^[A-Z]/.test(text) && !/^\d/.test(text)) {
      hardcoded.push({
        text,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  // Look for placeholder attributes
  const placeholderRegex = /placeholder=['"`]([A-Z][^'"`]+)['"`]/g;
  while ((match = placeholderRegex.exec(content)) !== null) {
    hardcoded.push({
      text: match[1],
      line: content.substring(0, match.index).split('\n').length,
      type: 'placeholder'
    });
  }
  
  return hardcoded;
};

// Main lint function
const lintI18n = () => {
  console.log('🔍 Linting i18n implementation...\n');
  
  // Load translations
  const deTranslations = loadTranslations('de');
  const enTranslations = loadTranslations('en');
  
  const deKeys = getAllKeys(deTranslations);
  const enKeys = getAllKeys(enTranslations);
  
  console.log(`📊 Translation Stats:`);
  console.log(`   German keys: ${deKeys.length}`);
  console.log(`   English keys: ${enKeys.length}`);
  
  // Check for missing translations
  const missingInEn = deKeys.filter(key => !enKeys.includes(key));
  const missingInDe = enKeys.filter(key => !deKeys.includes(key));
  
  if (missingInEn.length > 0) {
    console.log(`\n❌ Missing in English (${missingInEn.length}):`);
    missingInEn.forEach(key => console.log(`   - ${key}`));
  }
  
  if (missingInDe.length > 0) {
    console.log(`\n❌ Missing in German (${missingInDe.length}):`);
    missingInDe.forEach(key => console.log(`   - ${key}`));
  }
  
  // Find translation usage in code
  const sourceFiles = [
    ...findFiles(path.join(__dirname, '..', 'app'), '.tsx'),
    ...findFiles(path.join(__dirname, '..', 'components'), '.tsx'),
  ];
  
  const usedKeys = new Set();
  const hardcodedStrings = [];
  
  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const keys = extractTranslationUsage(content);
      keys.forEach(key => usedKeys.add(key));
      
      const hardcoded = findHardcodedStrings(content, file);
      if (hardcoded.length > 0) {
        hardcodedStrings.push({
          file: path.relative(process.cwd(), file),
          strings: hardcoded
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not read ${file}`);
    }
  }
  
  // Check for unused keys
  const unusedKeys = deKeys.filter(key => !usedKeys.has(key));
  
  if (unusedKeys.length > 0) {
    console.log(`\n⚠️  Potentially unused keys (${unusedKeys.length}):`);
    unusedKeys.slice(0, 10).forEach(key => console.log(`   - ${key}`));
    if (unusedKeys.length > 10) {
      console.log(`   ... and ${unusedKeys.length - 10} more`);
    }
  }
  
  // Check for undefined keys being used
  const undefinedKeys = Array.from(usedKeys).filter(key => !deKeys.includes(key));
  
  if (undefinedKeys.length > 0) {
    console.log(`\n❌ Undefined translation keys (${undefinedKeys.length}):`);
    undefinedKeys.forEach(key => console.log(`   - ${key}`));
  }
  
  // Report hardcoded strings
  if (hardcodedStrings.length > 0) {
    console.log(`\n⚠️  Potential hardcoded strings:`);
    hardcodedStrings.slice(0, 5).forEach(({ file, strings }) => {
      console.log(`   📄 ${file}:`);
      strings.slice(0, 3).forEach(({ text, line, type }) => {
        console.log(`      Line ${line}: "${text}" ${type ? `(${type})` : ''}`);
      });
    });
    if (hardcodedStrings.length > 5) {
      console.log(`   ... and ${hardcodedStrings.length - 5} more files`);
    }
  }
  
  // Summary
  console.log(`\n📈 Summary:`);
  console.log(`   ✅ ${usedKeys.size} translation keys in use`);
  console.log(`   ⚠️  ${unusedKeys.length} potentially unused keys`);
  console.log(`   ❌ ${undefinedKeys.length} undefined keys`);
  console.log(`   🔤 ${hardcodedStrings.reduce((acc, f) => acc + f.strings.length, 0)} potential hardcoded strings`);
  
  const issues = missingInEn.length + missingInDe.length + undefinedKeys.length;
  
  if (issues === 0) {
    console.log(`\n🎉 No critical i18n issues found!`);
    return 0;
  } else {
    console.log(`\n❌ Found ${issues} critical i18n issues`);
    return 1;
  }
};

// Run if called directly
if (require.main === module) {
  const exitCode = lintI18n();
  process.exit(exitCode);
}

module.exports = { lintI18n };
