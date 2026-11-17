// 批量重新上链：读取溯源数据，为每件商品重新计算哈希链并写回 JSON
// 用法：node tools/genchain.js
// 注意：仅重算链，不改商品/环节内容；如需从购买人表重新生成全部商品，用 genproducts.js
const fs = require('fs');
const path = require('path');
const { computeChain, sha256Hex } = require('../lib/app.js');

const dataPath = path.join(__dirname, '..', 'data', '溯源数据.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const products = data.products || [];
products.forEach(p => {
  const chain = computeChain(
    { code: p.code, name: p.name, price: p.price, brand: p.brand, origin: p.origin },
    p.stages
  );
  p.chain = chain.map(c => ({
    index: c.index,
    name: c.name,
    prevHash: c.prevHash,
    hash: c.hash
  }));
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

// 自检：sha256("abc") 应为标准向量
console.log('sha256(abc) =', sha256Hex('abc'));
console.log('应为 ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
console.log('已为', products.length, '件商品重新上链，每件', (products[0] && products[0].chain.length) || 0, '个区块');
