// 生成多商品溯源数据：52 件商品，一件一码，独立哈希链
// 用法：node tools/genproducts.js
const fs = require('fs');
const path = require('path');
const { computeChain, sha256Hex } = require('../lib/app.js');

const buyersPath = path.join(__dirname, '_buyers.json');
const buyers = JSON.parse(fs.readFileSync(buyersPath, 'utf8'));

// 品牌公共信息（从原单商品数据提取）
const brandInfo = {
  name: '珠绣包包',
  price: 128,
  brand: '拾珠绣',
  brandEn: 'PEARL VISION',
  slogan: '以珠为缀，绣活非遗',
  ip: '拾鸢',
  origin: '中国·泉州',
  brandIntro: '泉州刺桐港，海风载着千年珠绣技艺。拾珠绣 PEARL VISION 诞生于此，打造治愈系 IP「拾鸢」，将厚重的珠绣非遗转化为潮玩、随身配饰与文创小物，让古老珠绣在年轻人手中重新绽放光彩。'
};

// 制作环节时间基准（每件商品按序号偏移，模拟不同批次）
function makeStages(buyer, idx) {
  const day = idx; // 序号当偏移
  const mkDate = (offsetDays, hm) => {
    // 以 2026-11 为基准，向前推，保持演示合理
    const d = new Date(2026, 10, 8 + (offsetDays % 20));
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hm;
  };
  return [
    {
      id: 's1',
      name: '珠绣制作',
      time: mkDate(idx, '10:00'),
      place: '泉州·刺桐珠绣工坊',
      operator: '绣娘 陈XX',
      detail: '选用莹润珠粒，纯手工缝制珠绣包身，历时三日完成'
    },
    {
      id: 's2',
      name: '质量检验',
      time: mkDate(idx + 2, '15:30'),
      place: '拾珠绣品控中心',
      operator: '质检员 林XX',
      detail: '针脚牢固、珠粒均匀、包型周正，检验合格'
    },
    {
      id: 's3',
      name: '到店 / 购买人',
      time: buyer.time || mkDate(idx + 6, '09:00'),
      place: '泉州·古城文创店',
      operator: buyer.name,
      detail: '购买人 ' + buyer.name + (buyer.phone ? '，联系电话 ' + buyer.phone : '')
    }
  ];
}

const products = buyers.map((buyer, i) => {
  const stages = makeStages(buyer, i);
  const chain = computeChain(
    {
      code: buyer.code,
      name: brandInfo.name,
      price: brandInfo.price,
      brand: brandInfo.brand,
      origin: brandInfo.origin
    },
    stages
  ).map(c => ({ index: c.index, name: c.name, prevHash: c.prevHash, hash: c.hash }));

  return {
    code: buyer.code,
    name: brandInfo.name,
    price: brandInfo.price,
    brand: brandInfo.brand,
    brandEn: brandInfo.brandEn,
    slogan: brandInfo.slogan,
    ip: brandInfo.ip,
    origin: brandInfo.origin,
    brandIntro: brandInfo.brandIntro,
    stages: stages,
    chain: chain
  };
});

const out = {
  schema: 'zhuxiu-traceability-v2',
  brand: {
    name: brandInfo.name,
    price: brandInfo.price,
    brand: brandInfo.brand,
    brandEn: brandInfo.brandEn,
    slogan: brandInfo.slogan,
    ip: brandInfo.ip,
    origin: brandInfo.origin,
    brandIntro: brandInfo.brandIntro
  },
  products: products
};

fs.writeFileSync(
  path.join(__dirname, '..', 'data', '溯源数据.json'),
  JSON.stringify(out, null, 2),
  'utf8'
);

console.log('sha256(abc) =', sha256Hex('abc'));
console.log('应为 ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
console.log('已生成', products.length, '件商品，每件 4 个区块，共', products.length * 4, '个区块');
console.log('首件:', products[0].code, '| 末件:', products[products.length - 1].code);
