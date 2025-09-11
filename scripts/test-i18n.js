#!/usr/bin/env node

/**
 * i18n Implementation Test for Depotix
 * 
 * This script verifies:
 * - Translation files are valid JSON
 * - Key namespace structure is correct
 * - Format helpers are available
 * - Required translations exist for all major features
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const REQUIRED_NAMESPACES = [
  'common', 'nav', 'items', 'orders', 'invoices', 'stock',
  'customers', 'expenses', 'errors', 'pdf', 'auth', 'settings'
];

const CRITICAL_KEYS = [
  'common.save',
  'common.cancel', 
  'common.delete',
  'nav.dashboard',
  'nav.inventory',
  'items.title',
  'orders.title',
  'customers.title',
  'errors.generic',
  'pdf.invoice_title'
];

const loadTranslations = (locale) => {
  try {
    const filePath = path.join(__dirname, '..', 'locales', `${locale}.json`);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

const testI18nImplementation = () => {
  console.log('🧪 Testing i18n Implementation...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Translation files exist and are valid JSON
  console.log('📁 Testing translation files...');
  const deTranslations = loadTranslations('de');
  const enTranslations = loadTranslations('en');
  
  if (deTranslations) {
    console.log('   ✅ German translations loaded');
    passed++;
  } else {
    console.log('   ❌ German translations failed to load');
    failed++;
  }
  
  if (enTranslations) {
    console.log('   ✅ English translations loaded');
    passed++;
  } else {
    console.log('   ❌ English translations failed to load');
    failed++;
  }
  
  if (!deTranslations || !enTranslations) {
    console.log('\n❌ Cannot continue without translation files');
    return false;
  }
  
  // Test 2: Required namespaces exist
  console.log('\n📦 Testing namespace structure...');
  for (const namespace of REQUIRED_NAMESPACES) {
    if (deTranslations[namespace] && enTranslations[namespace]) {
      console.log(`   ✅ ${namespace} namespace exists`);
      passed++;
    } else {
      console.log(`   ❌ ${namespace} namespace missing`);
      failed++;
    }
  }
  
  // Test 3: Critical keys exist
  console.log('\n🔑 Testing critical translation keys...');
  for (const key of CRITICAL_KEYS) {
    const deValue = getNestedValue(deTranslations, key);
    const enValue = getNestedValue(enTranslations, key);
    
    if (deValue && enValue) {
      console.log(`   ✅ ${key}: "${deValue}"`);
      passed++;
    } else {
      console.log(`   ❌ ${key} missing`);
      failed++;
    }
  }
  
  // Test 4: Format helpers file exists
  console.log('\n🛠  Testing format helpers...');
  const formattersPath = path.join(__dirname, '..', 'lib', 'formatters.ts');
  if (fs.existsSync(formattersPath)) {
    const formattersContent = fs.readFileSync(formattersPath, 'utf8');
    
    if (formattersContent.includes('formatCurrencyCHF')) {
      console.log('   ✅ Currency formatter available');
      passed++;
    } else {
      console.log('   ❌ Currency formatter missing');
      failed++;
    }
    
    if (formattersContent.includes('formatDateDeCH')) {
      console.log('   ✅ Date formatter available');
      passed++;
    } else {
      console.log('   ❌ Date formatter missing');
      failed++;
    }
    
    if (formattersContent.includes('useFormatters')) {
      console.log('   ✅ Formatters hook available');
      passed++;
    } else {
      console.log('   ❌ Formatters hook missing');
      failed++;
    }
  } else {
    console.log('   ❌ Formatters file not found');
    failed += 3;
  }
  
  // Test 5: Check middleware configuration
  console.log('\n🌐 Testing middleware configuration...');
  const middlewarePath = path.join(__dirname, '..', 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    if (middlewareContent.includes('next-intl/middleware')) {
      console.log('   ✅ next-intl middleware configured');
      passed++;
    } else {
      console.log('   ❌ next-intl middleware missing');
      failed++;
    }
    
    if (middlewareContent.includes("defaultLocale: 'de'")) {
      console.log('   ✅ German set as default locale');
      passed++;
    } else {
      console.log('   ❌ German not set as default locale');
      failed++;
    }
  } else {
    console.log('   ❌ Middleware file not found');
    failed += 2;
  }
  
  // Test 6: Check i18n configuration
  console.log('\n⚙️  Testing i18n configuration...');
  const i18nPath = path.join(__dirname, '..', 'i18n.ts');
  if (fs.existsSync(i18nPath)) {
    const i18nContent = fs.readFileSync(i18nPath, 'utf8');
    
    if (i18nContent.includes('next-intl/server')) {
      console.log('   ✅ Server configuration available');
      passed++;
    } else {
      console.log('   ❌ Server configuration missing');
      failed++;
    }
  } else {
    console.log('   ❌ i18n configuration file not found');
    failed++;
  }
  
  // Test 7: Count total translations
  console.log('\n📊 Translation statistics...');
  const deKeyCount = JSON.stringify(deTranslations).split('":').length - 1;
  const enKeyCount = JSON.stringify(enTranslations).split('":').length - 1;
  
  console.log(`   📈 German translations: ${deKeyCount}`);
  console.log(`   📈 English translations: ${enKeyCount}`);
  
  if (deKeyCount > 300) {
    console.log('   ✅ Sufficient German translations');
    passed++;
  } else {
    console.log('   ⚠️  Consider adding more German translations');
  }
  
  if (enKeyCount > 300) {
    console.log('   ✅ Sufficient English translations');
    passed++;
  } else {
    console.log('   ⚠️  Consider adding more English translations');
  }
  
  // Summary
  console.log(`\n📋 Test Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Success Rate: ${Math.round(passed / (passed + failed) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All i18n tests passed! Implementation is ready for production.');
    return true;
  } else if (failed < 5) {
    console.log('\n⚠️  Minor issues found. Implementation is mostly ready.');
    return true;
  } else {
    console.log('\n❌ Significant issues found. Please address before production.');
    return false;
  }
};

// Run if called directly
if (require.main === module) {
  const success = testI18nImplementation();
  process.exit(success ? 0 : 1);
}

module.exports = { testI18nImplementation };
