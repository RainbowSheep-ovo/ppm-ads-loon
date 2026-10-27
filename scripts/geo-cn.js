/**
 * 皮皮喵极速版 · 附带脚本：ip-api 归属地伪装为「中国大陆」
 *
 * ⚠️ 实验性功能，默认不启用。抓包中 App 冷启动会请求
 *    http://ip-api.com/json/ ，本次返回的是香港 IP（Kirino LLC）。
 *    该请求的用途未确认（可能是「海外用户提示」或广告地域策略），
 *    所以是否启用、启用后是否更干净，需要你自己 A/B 测试。
 *
 * 启用方法：在主配置或插件里追加
 *
 *   [Script]
 *   http-response ^https?:\/\/ip-api\.com\/json script-path=https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/scripts/geo-cn.js,requires-body=true,tag=ip-api-CN
 *
 *   [MITM]
 *   hostname = ip-api.com
 *
 * 单独使用 enable=false 即可关闭，不需要删配置。
 */

const CN_GEO = {
  status: 'success',
  country: 'China',
  countryCode: 'CN',
  region: 'BJ',
  regionName: 'Beijing',
  city: 'Beijing',
  zip: '100000',
  lat: 39.9042,
  lon: 116.4074,
  timezone: 'Asia/Shanghai',
  isp: 'China Unicom',
  org: 'China Unicom',
  as: 'AS4808 China Unicom Beijing',
  query: '114.114.114.114'
};

$done({
  status: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(CN_GEO)
});
