const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TileObserver}=require('../uai-session.cjs');
test('exact message-end alignment is accepted without retaining or interpreting image bytes',()=>{
 for(let size=8;size<40;size++){
  const padding=(8-size%8)%8,packet=Buffer.alloc(size+padding,0xa5);
  packet.writeUInt16BE(3);packet.writeUInt16BE(size,2);
  for(let split=1;split<size;split++){
   const observer=new TileObserver();
   assert.equal(observer.feed(packet.subarray(0,split)),false);
   assert.equal(observer.feed(packet.subarray(split)),true);
   assert.equal(observer.feed(packet),true);
   assert.equal(observer.header.length,12);
  }
 }
});
test('screen-size alignment is not a frame; following real tile is detected',()=>{
 const o=new TileObserver();
 assert.equal(o.feed(Buffer.from([0,7,0,10,0,0,0,0,0,0,0,0,0,0,0,0])),false);
 assert.equal(o.feed(Buffer.from([0,3,0,10,0,0,0,0,255,217,0,0,0,0,0,0])),true);
});
test('jumbo alignment preserves declared size and fragmented image completion',()=>{
 const packet=Buffer.alloc(100016,0xa5);packet.writeUInt16BE(27);packet.writeUInt16BE(8,2);
 packet.writeUInt32BE(100003,4);packet.writeUInt16BE(3,8);
 const o=new TileObserver();assert.equal(o.feed(packet.subarray(0,50000)),false);
 assert.equal(o.feed(packet.subarray(50000)),true);
});
test('malformed headers and non-alignment suffixes still fail closed',()=>{
 assert.throws(()=>new TileObserver().feed(Buffer.from([0,3,0,1])),/KVM_LENGTH_BELOW_HEADER/);
 const tile=Buffer.from([0,3,0,10,0,0,0,0,255,217]);
 assert.throws(()=>new TileObserver().feed(Buffer.concat([tile,Buffer.alloc(8)])),/KVM_LENGTH_BELOW_HEADER/);
 const two=Buffer.concat([tile,tile]);assert.equal(new TileObserver().feed(two),true);
});
