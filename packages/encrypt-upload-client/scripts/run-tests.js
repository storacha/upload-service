
import { run } from 'node:test';
import { glob } from 'glob';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Find all test files
const files = await glob('test/**/*.spec.js', {
  ignore: ['**/*.playwright.spec.js'],
  absolute: true
});

console.log(`Found ${files.length} test files to run:`);
files.forEach(f => console.log(`- ${f}`));

try {
  // Create a stream of test results
  const testStream = run({
    files: files,
    concurrency: true,
    timeout: 60000 // Global timeout
  });

  // Pipe output to stdout (basic TAP reporter)
  testStream.on('data', (chunk) => process.stdout.write(chunk));

  // Determine exit code
  let failureCount = 0;
  testStream.on('test:fail', () => {
    failureCount++;
  });

  testStream.on('close', () => {
    console.log(`\nTests completed. Failures: ${failureCount}`);
    if (failureCount > 0) {
      console.error('❌ Tests failed');
      process.exit(1);
    } else {
      console.log('✅ Tests passed');
      process.exit(0);
    }
  });

} catch (err) {
  console.error('Failed to run tests:', err);
  process.exit(1);
}
