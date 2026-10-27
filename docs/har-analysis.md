# 抓包分析报告

- 样本：`106_1793134263859.har`（iOS，Loon 导出，35 条请求，约 3 秒冷启动片段）
- 设备：iPhone，iOS 18.7
- App：皮皮喵极速版（`app_ver=0.7.28`，`version_code=0.59`）
- 采集时间：2026-10-28 04:51:10 (±08:00)

---

## 1. 请求全貌

35 条请求里，**18 条是 App 自己发出的 DoH 查询**（`doh.pub` + `dns.alidns.com` 各查一遍，用于域名解析），实际业务请求只有 17 条：

| # | 域名 | 路径 | 状态 | 归类 |
| --- | --- | --- | --- | --- |
| 1 | `dev.azure.com` | `/_apis/git/.../items?path=/datas/users_ios_free` | 200 (6798 B) | 配置数据 |
| 2 | `dev.azure.com` | `...?path=/datas/app_ios_store_free` | 200 (15360 B) | 配置数据 |
| 3 | `gitlab.com` | `/ghostgzt/ppcat/-/raw/master/version_ios` | 200 | 版本检查 |
| 4 | `github.com` | `/ghostgzt/ppcat/blob/master/version_ios` | 200 (HTML) | 版本检查（备用） |
| 5 | `gitcode.net` | `/mio/ppcat/-/raw/master/datas/*` ×2 | **418** | 已失效镜像 |
| 6 | `jihulab.com` | `/ghostgzt/ppcat/-/raw/main/datas/*` ×2 | **401** | 已失效镜像 |
| 7 | `mwfimsvfast9.cc` | `/static/upload3/book/id/*/cover_1.jpg` ×4 | **0（连接失败）** | 书源封面 |
| 8 | `mssdk.volces.com` | `/ri/report_otob?...` | 200 | **字节 SDK 埋点** |
| 9 | `tnc3-alisc1.zijieapi.com` | `/get_domains/v4/?aid=1371` | 200 | **字节 TTNet HTTP-DNS** |
| 10 | `lf-cdn-tos.bytescm.com` | `/obj/static/ad/play-comp/.../package.ugen.json` | 200 | **穿山甲试玩广告 SDK** |
| 11 | `ip-api.com` | `/json/` | 200 | 归属地查询 |
| 12 | `mmbiz.qpic.cn` | `/mmbiz_jpg/...` | 304 | 公众号文章配图（公告/推广页） |

---

## 2. 关键证据

### 2.1 广告 SDK = 字节「穿山甲」v5.5.0.7

`lf-cdn-tos.bytescm.com` 的请求参数直接暴露了 SDK 版本和 AppID：

```
/obj/static/ad/play-comp/playable-component-sdk/package.ugen.json
    ?aid=5000546&version_code=5.5.0.7&device_platform=iphone
```

- `aid=5000546` → 该 App 在穿山甲平台的 **AppID**
- `version_code=5.5.0.7` → 穿山甲 iOS SDK 版本
- `playable-component-sdk` → 试玩广告组件（只有接了激励视频/试玩广告才会拉）

另一路 `tnc3-alisc1.zijieapi.com/get_domains/v4/?aid=1371&version_code=5507` 里的 `5507` 也是 5.5.07 的另一种写法，`aid=1371` 是字节 TTNet 侧的应用编号。

### 2.2 SDK 埋点内容（已解密）

`mssdk.volces.com/ri/report_otob` 是一个 2.8 KB 的 protobuf POST，参数表明它是 SDK 遥测：

```
sdk_ver=v07.01.01-ml-iOS  app_ver=0.7.28  sdkid=1371
client_type=business      region_type=ml  mode=2
user-agent: ByteDance-MSSDK
```

请求体内容为 protobuf，不可读；但从 `sdk_aid: 3019`、`x-tt-request-tag` 可以确认是字节标准的数据上报通道。拦掉它对功能无影响。

### 2.3 TTNet 下发了广告服务器 IP（已解密）

`tnc3-alisc1.zijieapi.com/get_domains/v4/` 返回：

```json
{"data":{
  "chromium_open":1,
  "ttnet_enable_cronet_request_report":1,
  "ttnet_url_dispatcher_enabled":1,
  "ttnet_http_dns_addr":{
    "tnc0-alisc1.zijieapi.com":"47.106.88.76,47.106.84.116,120.78.234.27,120.78.189.22",
    "tnc0-bjlgy.zijieapi.com":"8.133.123.137,8.133.123.138,8.133.123.139,8.133.123.140",
    "tnc0-aliec2.zijieapi.com":"8.133.123.137,8.133.123.138,8.133.123.139,8.133.123.140"
  },
  "send_tnc_host_arrays":["tnc0-alisc1.zijieapi.com","tnc0-aliec2.zijieapi.com"]
},"message":"success","summary":"15b398cc6375696f6fe39cbfaf10b630"}
```

这是字节的「HTTP DNS 下发」机制：SDK 拿到这组域名后可以**完全绕过系统 DNS**，直接用 IP 连接。所以只在 DNS 层做拦截是无效的，必须在**域名规则层** REJECT（Loon 依据 TLS SNI / Host 匹配，与解析方式无关）——这也是本插件把 `tnc*.zijieapi.com` 一并 REJECT 的原因。

### 2.4 配置数据是加密的

App 从 4 个镜像拉两份数据文件（`dev.azure.com` 是当前唯一可用的）：

| 文件 | 大小 | 熵 | 首字节 |
| --- | --- | --- | --- |
| `datas/users_ios_free` | 6798 B | 7.960 | `75 97 60 15 75 86 be be…` |
| `datas/app_ios_store_free` | 15360 B | 7.981 | `57 05 df bf 41 5c ed f2…` |

熵接近 8.0（完全随机），且长度不是 16 的整数倍（6798 = 16×424 + 14），说明是**流式加密**（AES-CTR / ChaCha20 之类）而非分块加密。仓库里同时存在不带 `_free` 后缀的版本：

```
datas/users_ios        8347 B   ← 存在
datas/app_ios_store   13375 B   ← 存在
datas/users_ios_vip   404       ← 不存在
datas/app_ios_store_vip 404     ← 不存在
```

即只有「极速版（free）」和「正式版」两套数据，没有 VIP 变体。**结论：广告位配置写在 App 二进制里，不是服务器下发的**，所以改数据包这条路走不通，也解释了为什么只需要拦 SDK。

`version_ios` 则是明文（外层是 `data:app/ppcat;version,` + base64 的 data URI）：

```json
{"version":"0.2.6","versionCode":200111,"forceVersion":191201,
 "updateUrl":"https://www.lanzoux.com/b932237","updateContent":""}
```

---

## 3. 结论：能拦什么、不能拦什么

**能拦（本插件已覆盖）**

1. 穿山甲 `get_ads` 广告拉取 → 开屏 / 插屏 / 信息流 / 激励视频全部无填充，SDK 原生走 `no fill` 分支，不弹错误框。
2. 广告素材 CDN（`*.pangle.io`、`*.pglstatp-toutiao.com`）→ 即使有历史缓存也无法重新下载。
3. `mssdk.volces.com` 埋点 → 省流量、省电。
4. `tnc*.zijieapi.com` HTTP-DNS → 防止 SDK 用 IP 直连绕过域名拦截。
5. 试玩广告（Playable）组件 → URL Rewrite 返回空 200。

**拦不了（任何基于网络抓包的方案都拦不了）**

- App 内置的静态推广位 / 公告：内容来自加密数据包，与网络请求无关。
- 公告页里的公众号文章（`mp.weixin.qq.com` + `mmbiz.qpic.cn`）：这是正常的网页浏览，封了会影响其他场景。
- App 若未来接入第二家广告联盟（优量汇 / 快手 / 百度），需要补充对应域名。

---

## 4. 可选调整

### 4.1 启动加速（未包含在插件内）

App 会**并发**请求 5 个镜像，其中 `gitcode.net`（418）和 `jihulab.com`（401）早已失效，白白多等 ~0.6 秒。只想加速、不想拦截时，可单独加这两条（注意：`gitcode.net` 是全局生效的）：

```
DOMAIN,gitcode.net,REJECT
DOMAIN,jihulab.com,REJECT
```

### 4.2 归属地伪装（实验性，不建议默认开启）

App 启动时会请求 `http://ip-api.com/json/`，本次抓包返回的是**香港**（`"country":"Hong Kong","isp":"Kirino LLC"`）。用途未知，可能是「海外用户提示」或「广告地域策略」。如果你想验证它是否影响广告行为，可加：

```
[Script]
http-response ^https?:\/\/ip-api\.com\/json script-path=https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/scripts/geo-cn.js,requires-body=true,tag=ip-api-CN

[MITM]
hostname = ip-api.com
```

并在 `scripts/geo-cn.js` 里返回固定的中国大陆结果。**风险未知，默认不开。**

### 4.3 换用正式版数据包（未验证）

把请求路径中的 `_free` 换成无后缀版本：

```
^https?:\/\/dev\.azure\.com\/.*\/items\?path=\/datas\/users_ios_free$  header https://dev.azure.com/xo/2cc4c8ac-7420-4bd5-a166-7d1e498c1cda/_apis/git/repositories/3d037897-2ba8-4c1d-9b07-8238d71fdc64/items?path=/datas/users_ios
```

理论上极速版会读到正式版的书源配置。但两份数据用同一套加密（App 内置密钥通常与版本绑定），**可能直接解析失败导致书架/书城空白**。仅作记录，不要写进正式插件。

---

## 5. 复用本报告

HAR 里的全部响应体都可由下列脚本还原（HAR 中 `encoding: "base64"` 需要先解码）：

```python
import json, base64, zlib, gzip

har = json.load(open("106_1793134263859.har", encoding="utf-8"))
for e in har["log"]["entries"]:
    c = e["response"]["content"]
    raw = base64.b64decode(c["text"]) if c.get("encoding") == "base64" else c["text"].encode()
    # 部分响应还套了一层 gzip
    try:
        raw = gzip.decompress(raw)
    except Exception:
        pass
    print(e["request"]["url"], len(raw))
```
