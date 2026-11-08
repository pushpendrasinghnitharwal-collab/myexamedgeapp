import test from 'node:test'
import assert from 'node:assert/strict'
import {DEST_PASSAGES} from '../src/data/destPassages.js'
import {scoreDest,withinDestLimit,remainingDestMs,DEST_CATEGORIES,DEST_DURATION_MS} from '../src/lib/destScoring.js'

test('original practice passages contain exactly 2000 printable ASCII characters',()=>{
  assert.ok(DEST_PASSAGES.length>=2)
  for(const passage of DEST_PASSAGES){assert.equal(passage.text.length,2000);assert.match(passage.text,/^[\x20-\x7e]+$/);assert.ok(passage.text.endsWith('.'))}
})
test('an exact 2000-character passage scores zero mistakes and 26.67 gross WPM over 15 minutes',()=>{
  for(const passage of DEST_PASSAGES){const result=scoreDest(passage.text,passage.text,{textKeydowns:2000,elapsedMs:DEST_DURATION_MS});assert.equal(result.full_mistakes,0);assert.equal(result.half_mistakes,0);assert.equal(result.error_percentage,0);assert.equal(result.gross_wpm,26.67)}
})
test('DEST practice scoring handles spelling, omission, insertion, repetition and incomplete words',()=>{
  for(const [typed,full] of [['cat dog',0],['cat dig',1],['cat',1],['dog',1],['cat dog bird',1],['cat cat dog',1],['cat do',1],['',2]]){
    const result=scoreDest('cat dog',typed)
    assert.equal(result.full_mistakes,full,typed);assert.equal(result.half_mistakes,0,typed)
  }
})
test('DEST practice scoring handles case, punctuation, spacing and transposition as half mistakes',()=>{
  for(const [reference,typed,half] of [['Hello world.','hello world.',1],['hello, world.','hello world.',1],['hello world','helloworld',1],
    ['hello world','hel lo world',1],['hello, world','helloworld',2],['hello','hel,lo',1],['HELLO','hello',5],['I hope','hope I',1],['hello world','hello  world',1],['hello.','hello!',1]]){
    const result=scoreDest(reference,typed)
    assert.equal(result.full_mistakes,0,`${reference} vs ${typed}`);assert.equal(result.half_mistakes,half,`${reference} vs ${typed}`)
  }
})
test('practice percentage uses unrounded weighted mistakes and whole passage, with no speed inflation from backspace',()=>{
  const result=scoreDest('one two three four','One two three four',{textKeydowns:40,backspaces:3,deletes:2,elapsedMs:60000})
  assert.equal(result.full_mistakes,0);assert.equal(result.half_mistakes,1);assert.equal(result.error_percentage,12.5)
  assert.equal(result.total_key_depressions,45);assert.equal(result.gross_wpm,8);assert.equal(withinDestLimit(result,12.5),true)
  assert.equal(withinDestLimit({...result,reference_words:101,full_mistakes:5,half_mistakes:1},5),false,'do not compare rounded display percentages')
  const empty=scoreDest('one two three','');assert.equal(empty.error_percentage,100)
  assert.throws(()=>scoreDest('one','x'.repeat(5001)))
})
test('DEST normal and historical higher standards are not conflated',()=>{
  assert.deepEqual(DEST_CATEGORIES.map(({normal,historical})=>[normal,historical]),[[20,5],[25,7],[30,7],[30,10],[30,null]])
})
test('DEST remaining time is clamped across sleep and backwards clock changes',()=>{
  assert.equal(remainingDestMs(10000,500,11000,1500),DEST_DURATION_MS-1000)
  assert.equal(remainingDestMs(10000,500,70000,1500),DEST_DURATION_MS-60000)
  assert.equal(remainingDestMs(10000,500,1000,10500),DEST_DURATION_MS-10000)
  assert.equal(remainingDestMs(10000,500,1000,500,500),500)
  assert.equal(remainingDestMs(10000,500,10000+DEST_DURATION_MS,500),0)
})

test('DEST tab recovery is account-scoped and reset leaves unrelated storage alone',async()=>{
  const {loadDestSession,saveDestSession,clearDestSession,clearDestSessions}=await import('../src/lib/destStore.js')
  const previous=globalThis.sessionStorage,data=new Map()
  globalThis.sessionStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),key:index=>[...data.keys()][index],get length(){return data.size}}
  try{
    data.set('unrelated','keep');assert.equal(saveDestSession('account-a',{text:'a'}),true);assert.equal(saveDestSession('account-b',{text:'b'}),true)
    assert.deepEqual(loadDestSession('account-a'),{text:'a'});assert.deepEqual(loadDestSession('account-b'),{text:'b'});clearDestSession('account-a')
    assert.equal(loadDestSession('account-a'),null);assert.deepEqual(loadDestSession('account-b'),{text:'b'});clearDestSessions();assert.equal(loadDestSession('account-b'),null);assert.equal(data.get('unrelated'),'keep')
    globalThis.sessionStorage={setItem(){throw new Error('blocked')},getItem(){throw new Error('blocked')}}
    assert.equal(saveDestSession('account-a',{}),false);assert.equal(loadDestSession('account-a'),null)
  }finally{globalThis.sessionStorage=previous}
})
