import { AgentData } from '@storacha/access/agent'
import { Client } from '../src/client.js'
import { withContext, test } from './test.js'
import { randomBytes } from './helpers/random.js'
import { File } from './helpers/shims.js'
import { receiptsEndpoint } from './helpers/utils.js'

/** @type {import('./test.js').Suite} */
export const testLargeUpload = {
  uploadLargeDirectory: withContext({
    'should handle uploading 100K files': async (
      assert,
      { connection, provisionsStorage }
    ) => {
      // Try with 100K files to reproduce the reported issue
      const numFiles = 100000;
      const fileSize = 1024; // 1KB
      
      console.log('Generating 100K test files...');
      const files = await Promise.all(
        Array.from({ length: numFiles }, async (_, index) => {
          const bytes = await randomBytes(fileSize);
          return new File([bytes], `file-${index}.txt`);
        })
      );
      console.log('Generated all 100K test files');

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      });

      const space = await alice.createSpace('large-upload-test-100k', {
        skipGatewayAuthorization: true,
      });
      const auth = await space.createAuthorization(alice);
      await alice.addSpace(auth);
      await alice.setCurrentSpace(space.did());

      // Setup billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      });

      try {
        console.log('Starting directory upload for 100K files...');
        console.log('Using space:', space.did());
        const dataCID = await alice.uploadDirectory(files);
        console.log('Upload completed successfully:', dataCID.toString());
        assert.ok(dataCID);
      } catch (err) {
        if (err instanceof Error) {
          console.error('Error details:');
          console.error('- Message:', err.message);
          console.error('- Name:', err.name);
          console.error('- Stack:', err.stack);
          if ('cause' in err) {
            const cause = err.cause;
            console.error('- Cause:', cause);
            if (cause && typeof cause === 'object' && 'stack' in cause) {
              console.error('- Cause Stack:', cause.stack);
            }
          }
          
          if (err.message.includes('Maximum call stack size exceeded')) {
            console.log('Got expected stack overflow error with 100K files');
          }
          throw err;
        } else {
          console.error('Unexpected non-Error object thrown:', err);
          throw err;
        }
      }
    },
  }),
}; 

// Run the tests
test({ 'Large Upload': testLargeUpload }); 