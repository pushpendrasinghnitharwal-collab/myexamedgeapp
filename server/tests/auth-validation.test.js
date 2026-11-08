import test from 'node:test'
import assert from 'node:assert/strict'
import {validateRegistration} from '../auth-validation.js'
test('new practice accounts validate input before hashing or writing',()=>{
  assert.deepEqual(validateRegistration({name:' Learner ',email:' LEARNER@example.com ',password:'passphrase',targetExam:'ssc-cgl'}),{name:'Learner',email:'learner@example.com',password:'passphrase',targetExam:'ssc-cgl'})
  assert.match(validateRegistration({name:' ',email:'a@example.com',password:'12345678'}).error,/Name/)
  assert.match(validateRegistration({name:'Learner',email:'not-an-email',password:'12345678'}).error,/email/)
  assert.match(validateRegistration({name:'Learner',email:'a@example.com',password:'short'}).error,/Password/)
  assert.match(validateRegistration({name:'Learner',email:'a@example.com',password:'😀'.repeat(19)}).error,/Password/)
  assert.match(validateRegistration({name:'Learner',email:'a@example.com',password:'12345678',targetExam:{}}).error,/target/)
})
