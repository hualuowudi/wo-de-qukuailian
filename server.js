// 拾珠绣 · 区块链溯源系统 —— 静态服务器 + 导入接口（零第三方依赖）
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const XLSX = require('./lib/xlsx.full.min.js');
const { computeChain, sha256Hex } = require('./lib/app.js');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', '溯源数据.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8'
};

function lanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  return ips;
}

// 格式化时间（Date 或字符串 → 'YYYY-MM-DD HH:mm'）
function fmtTime(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    if (isNaN(v)) return '';
    const pad = n => String(n).padStart(2, '0');
    return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate()) +
      ' ' + pad(v.getHours()) + ':' + pad(v.getMinutes());
  }
  return String(v).trim();
}

// 单元格值 → 字符串（数字电话转字符串）
function toStr(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).trim();
}

// 从上传的 Excel 生成溯源数据
function buildDataFromSheet(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) throw new Error('表格为空');

  // 解析表头，定位各字段列
  const header = rows[0].map(h => toStr(h));
  const idx = {};
  const map = {
    '防伪码': 'code', '专属代码': 'code', '代码': 'code',
    '商品名称': 'name', '商品名': 'name',
    '价格': 'price',
    '绣娘': 'xiuniang',
    '质检员': 'zjy',
    '制作时间': 'makeTime',
    '质检时间': 'qcTime',
    '购买人名称': 'buyer', '购买人': 'buyer', '客户名称': 'buyer', '客户': 'buyer',
    '购买人电话': 'buyerPhone', '电话': 'buyerPhone',
    '购买时间': 'buyTime', '采购时间': 'buyTime'
  };
  header.forEach((h, i) => {
    if (h && map[h]) idx[map[h]] = i;
  });
  if (idx.code == null) throw new Error('表格缺少「防伪码」列');
  if (idx.name == null) throw new Error('表格缺少「商品名称」列');

  const brand = {
    brand: '拾珠绣', brandEn: 'PEARL VISION',
    slogan: '以珠为缀，绣活非遗', ip: '拾鸢', origin: '中国·泉州',
    brandIntro: '泉州刺桐港，海风载着千年珠绣技艺。拾珠绣 PEARL VISION 诞生于此，打造治愈系 IP「拾鸢」，将厚重的珠绣非遗转化为潮玩、随身配饰与文创小物，让古老珠绣在年轻人手中重新绽放光彩。'
  };

  const products = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = toStr(row[idx.code]);
    if (!code) continue;

    const name = toStr(row[idx.name]) || '珠绣包包';
    const price = row[idx.price] != null && row[idx.price] !== '' ? Number(row[idx.price]) || 0 : 128;
    const xiuniang = toStr(row[idx.xiuniang]) || '陈XX';
    const zjy = toStr(row[idx.zjy]) || '林XX';
    const makeTime = fmtTime(row[idx.makeTime]) || '2026-11-08 10:00';
    const qcTime = fmtTime(row[idx.qcTime]) || '2026-11-10 15:30';
    const buyer = toStr(row[idx.buyer]) || '';
    const buyerPhone = toStr(row[idx.buyerPhone]);
    const buyTime = fmtTime(row[idx.buyTime]);

    const stages = [
      {
        id: 's1', name: '珠绣制作', time: makeTime,
        place: '泉州·刺桐珠绣工坊', operator: '绣娘 ' + xiuniang,
        detail: '选用莹润珠粒，纯手工缝制珠绣包身，历时三日完成'
      },
      {
        id: 's2', name: '质量检验', time: qcTime,
        place: '拾珠绣品控中心', operator: '质检员 ' + zjy,
        detail: '针脚牢固、珠粒均匀、包型周正，检验合格'
      },
      {
        id: 's3', name: '到店 / 购买人', time: buyTime || '2026-11-14 09:00',
        place: '泉州·古城文创店', operator: buyer || '购买人',
        detail: '购买人 ' + (buyer || '—') + (buyerPhone ? '，联系电话 ' + buyerPhone : '')
      }
    ];

    const product = {
      code, name,
      price, brand: brand.brand, brandEn: brand.brandEn,
      slogan: brand.slogan, ip: brand.ip, origin: brand.origin, brandIntro: brand.brandIntro,
      stages
    };
    const chain = computeChain(
      { code: product.code, name: product.name, price: product.price, brand: product.brand, origin: product.origin },
      product.stages
    ).map(c => ({ index: c.index, name: c.name, prevHash: c.prevHash, hash: c.hash }));
    product.chain = chain;

    products.push(product);
  }

  if (!products.length) throw new Error('表格中没有有效数据（防伪码列为空）');

  return {
    schema: 'zhuxiu-traceability-v2',
    brand: { name: '珠绣包包', price: 128, brand: brand.brand, brandEn: brand.brandEn, slogan: brand.slogan, ip: brand.ip, origin: brand.origin, brandIntro: brand.brandIntro },
    products
  };
}

const server = http.createServer((req, res) => {
  // ---------- 导入接口 ----------
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/import') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const data = buildDataFromSheet(buf);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, count: data.products.length, message: '导入成功，共 ' + data.products.length + ' 件商品，已重新上链' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: e.message || '导入失败' }));
      }
    });
    return;
  }

  // ---------- 静态文件 ----------
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/CXY.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = parseInt(process.env.PORT || '8080', 10);
server.listen(PORT, () => {
  console.log('==========================================');
  console.log('  拾珠绣 · 区块链溯源系统 已启动');
  console.log('------------------------------------------');
  console.log('  客户查询页 : http://127.0.0.1:' + PORT + '/CXY.html');
  console.log('  后台演示台 : http://127.0.0.1:' + PORT + '/admin.html');
  const ips = lanIPs();
  if (ips.length) {
    console.log('------------------------------------------');
    console.log('  手机扫码（连同一 WiFi）地址：');
    ips.forEach(ip => console.log('    http://' + ip + ':' + PORT + '/CXY.html'));
  }
  console.log('==========================================');
  console.log('  关闭本窗口即可停止服务');
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('[错误] 端口 ' + PORT + ' 已被占用，请关闭占用程序后重试，或设置 PORT 环境变量换端口。');
  } else {
    console.log('[错误] 启动失败：' + e.message);
  }
});
