/** Disabled-feature tests only. onCall.run bypasses HTTP/AppCheck and token verification. */
import test,{after,mock} from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT='demo-hackaton';
delete process.env.ENABLE_QWENCLOUD;
const {analyzeInventoryProduct}=await import('../lib/apps/functions/src/index.js');
const {getFirestore}=await import('firebase-admin/firestore');
const db=getFirestore();
const collection=mock.method(db,'collection',()=>{throw Error('Disabled Qwen must not access Firestore');});
const transaction=mock.method(db,'runTransaction',async()=>{throw Error('Disabled Qwen must not consume quota');});
const fetcher=mock.method(globalThis,'fetch',async()=>{throw Error('Disabled Qwen must not call a provider');});
after(()=>{collection.mock.restore();transaction.mock.restore();fetcher.mock.restore();});
const data={storeId:'shop_qa',operationId:'123e4567-e89b-42d3-a456-426614174000',text:'Jirafa de madera',image:''};
const code=(name:string)=>(error:unknown)=>!!error&&typeof error==='object'&&'code'in error&&error.code===name;

test('Qwen apagado por defecto rechaza solicitud autenticada antes de Firestore y proveedor',async()=>{
 assert.equal(process.env.ENABLE_QWENCLOUD,undefined);
 await assert.rejects(analyzeInventoryProduct.run({data,auth:{uid:'operator_qa',token:{}}} as never),code('failed-precondition'));
 assert.equal(collection.mock.callCount(),0);
 assert.equal(transaction.mock.callCount(),0);
 assert.equal(fetcher.mock.callCount(),0);
});
test('Qwen apagado sigue exigiendo autenticación',async()=>{
 await assert.rejects(analyzeInventoryProduct.run({data} as never),code('unauthenticated'));
 assert.equal(collection.mock.callCount(),0);
 assert.equal(transaction.mock.callCount(),0);
 assert.equal(fetcher.mock.callCount(),0);
});
test('metadata del callable apagado no solicita secretos de Qwen',()=>{
 const endpoint=(analyzeInventoryProduct as unknown as {__endpoint:{secretEnvironmentVariables?:unknown[]}}).__endpoint;
 assert.ok(endpoint,'Callable deployment metadata must be available');
 assert.deepEqual(endpoint.secretEnvironmentVariables??[],[]);
});
