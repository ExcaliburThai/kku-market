import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postInput} from './validation.js';
const valid={title:' หนังสือ ',description:'สภาพดี',price:120,imagePath:null};
test('valid input trims title',()=>assert.equal(postInput(valid,'abc').title,'หนังสือ'));
test('reject negative and nonfinite price',()=>{for(const price of [-1,NaN,Infinity,'100'])assert.throws(()=>postInput({...valid,price},'abc'));});
test('reject another owner image',()=>assert.throws(()=>postInput({...valid,imagePath:'posts/other/12345678-1234-1234-1234-123456789012'},'abc')));
test('reject blank title',()=>assert.throws(()=>postInput({...valid,title:' '},'abc')));
