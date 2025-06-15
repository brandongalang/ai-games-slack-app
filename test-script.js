// Quick test script for core services
const { execSync } = require('child_process');

console.log('🧪 Testing AI Games App Services...\n');

try {
  // Test TypeScript compilation
  console.log('1. Testing TypeScript compilation...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful!\n');

  // Test import structure
  console.log('2. Testing service imports...');
  const services = [
    './dist/services/userService.js',
    './dist/services/xpService.js', 
    './dist/services/promptLibraryService.js',
    './dist/services/clarityService.js',
    './dist/services/leaderboardService.js'
  ];

  services.forEach(service => {
    try {
      require(service);
      console.log(`✅ ${service.split('/').pop()} imports successfully`);
    } catch (error) {
      console.log(`❌ ${service.split('/').pop()} import failed:`, error.message);
    }
  });

  console.log('\n🎉 Core services are ready for testing!');
  console.log('\nNext steps:');
  console.log('1. Set up your .env file with API keys');
  console.log('2. Run database migrations in Supabase'); 
  console.log('3. Start the app with: npm run dev');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}