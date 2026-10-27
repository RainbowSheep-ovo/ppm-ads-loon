# 抓包分析报告（三轮）

| | 第一轮 | 第二轮 | 第三轮 |
| --- | --- | --- | --- |
| 文件 | `106_1793134263859.har` | `Stream-2026-10-28 054720.har` | `112_1793138547466.har` |
| 工具 | Loon | Stream 1.0.6 | Loon |
| 请求数 | 35 | 37 | 56 |
| 覆盖时长 | ~3 s（冷启动片段） | ~35 s | 冷启动 + 弹窗 |
| 是否含广告请求 | **否** | **是** | 否（已被拦截） |
| 关键发现 | 误判为穿山甲 | **真凶是 Google AdMob** | 反拦截弹窗 + 域名轮换 |

> 第三轮的专项分析（「故障」弹窗）见 [anti-adblock-dialog.md](anti-adblock-dialog.md)。

---

## 0. 结论先行

开屏广告链路：

```
App 冷启动
  └─ Google Mobile Ads SDK (afma-sdk-i-v9.14.0)
       ├─ GET  googleads.g.doubleclick-cn.net/getconfig/pubsetting     ← 拉配置
       ├─ GET  googleads.g.doubleclick-cn.net/mads/gma                ← 拉广告（35171 B 响应）
       ├─ GET  .../mads/static/mad/sdk/native/sdk-core-loader-inline.html  ← 广告 WebView 壳
       ├─ GET  pagead2.googleadservices-cn.com/pagead/adview          ← 展示
       ├─ GET  pagead2.googlesyndication-cn.com/pcs/activeview        ← 曝光打点
       ├─ GET  csi.gstatic.com/csi  ×7                                ← 性能打点
       └─ 聚合兜底：POST sdk.e.qq.com/mediation（腾讯优量汇，本次未填充）
```

穿山甲（Pangle）确实接入了，但 `get_ads` 返回业务错误码，**没有在投广告**。

---

## 1. 第一轮为什么误判

第一轮 HAR 只有 35 条请求、约 3 秒，从头到尾**没有任何一条广告拉取请求**。当时能看到的只有：

- `lf-cdn-tos.bytescm.com/obj/static/ad/play-comp/playable-component-sdk/package.ugen.json?aid=5000546&version_code=5.5.0.7`
  → 据此认定 SDK 是「穿山甲 v5.5.0.7、AppID 5000546」
- `mssdk.volces.com/ri/report_otob`（字节埋点）
- `tnc3-alisc1.zijieapi.com/get_domains/v4/`（字节 TTNet HTTP-DNS）

这些证据都是真的，但**只能证明"接了穿山甲"，不能证明"广告来自穿山甲"**。这是个典型的推理跳跃：把「存在」当成了「因果」。

第二轮数据把这个跳跃证伪了：穿山甲 `get_ads` 返回

```json
{"request_id":"755925DF-FDE1-4CF4-9CE6-CBB66C38B6F6","status_code":40006,"reason":0,"desc":"广告位ID不合法"}
```

`40006 = 广告位ID不合法`，即 App 里填的穿山甲 slot ID 无效，SDK 拿不到任何广告。

另外还发现第一轮的域名规则本身有 bug：穿山甲有两个域名，

```
api-access.pangolin-sdk-toutiao.com
api-access.pangolin-sdk-toutiao1.com      ← 多一个「1」
```

`DOMAIN-SUFFIX,pangolin-sdk-toutiao.com` 无法匹配 `...toutiao1.com`（不是以 `.pangolin-sdk-toutiao.com` 结尾），所以连这块也是漏的。

---

## 2. 第二轮的完整证据

### 2.1 App 身份

从 `toblog.ctobsnssdk.com` 的查询参数里直接读出：

```
app_name    = 皮皮喵Lite
channel     = App Store
app_version = 0.7.28
version_code= 0.7.28
os          = iOS
os_version  = 27.0
device_model= iPhone14,3
aid         = 164362
host_appid  = 5104488
device_id   = 4215986752859961
```

AdMob 侧则是：

```
GET /getconfig/pubsetting?app_name=com.gentle.ppcat-free
                        &vnm=0.7.28
                        &client=ca-app-pub-5440663071705011
                        &admob_appcc=7725269900
```

- Bundle ID：`com.gentle.ppcat-free`（免费版）
- AdMob 发布商 ID：`ca-app-pub-5440663071705011`
- AdMob App ID：`7725269900`

### 2.2 广告格式：视频插屏

`csi.gstatic.com/csi` 里有完整的广告元数据：

```
j_e_ad_format = js_video_ctd
j_e_layout    = video_ctd/interstitial_campari_v7
j_e_demand    = aci
j_e_cmp_id    = 24126736259
j_e_wi = 428   j_e_he = 846     ← 屏幕尺寸
j_e_placement = 1
```

`Campari` 是 Google 应用安装广告的项目代号，`video_ctd` 即视频点击下载素材。这就是开屏看到的那条视频广告。

### 2.3 聚合（mediation）确实尝试过优量汇

```
GET googleads.g.doubleclick-cn.net/pagead/interaction/?label=admob_mediation_request_fill_result
                                                      &mediation_fill_status=-3.0.465.-3
```

配合 `sdk.e.qq.com` 的 `/mediation?version=1`、`/launch`（响应 2564 B）、`/event` ×3、`/msg`，
可以确认：AdMob 在自家没填满时会去问腾讯优量汇要广告。本次 `-3` 表示未填充，所以最终展示的是 AdMob 自营素材。

**这意味着只封 AdMob 可能不够**——封掉后 SDK 可能更积极地走聚合。所以插件把 `sdk.e.qq.com` 一起拦了。

### 2.4 穿山甲仍在偷偷下载，但没广告

| 请求 | 说明 |
| --- | --- |
| `POST api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/get_ads/` | 返回 40006 广告位ID不合法 |
| `POST api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/settings/` | 返回 **21154 B** 加密配置 |
| `POST api-access.pangolin-sdk-toutiao1.com/.../stats/batch/` ×4 | 埋点，单次请求体 2.4–3.9 KB |
| `GET sf3-fe-tos.pglstatp-toutiao.com/obj/ad-pattern/build/renderer/1.0.0.2512/fallback.js` ×2 | **507 KB × 2 = 1 MB** 渲染器 |
| `GET lf-cdn-tos.bytescm.com/obj/static/ad/play-comp/.../index-H7RW3GBV.js` | 试玩广告组件 |

37 条请求的响应体总计约 **1.9 MB**，其中穿山甲的渲染器就占了 1 MB 以上——纯浪费。

### 2.5 非广告流量（不要拦）

| 域名 | 用途 |
| --- | --- |
| `toblog.ctobsnssdk.com` | 字节 AppLog / 设备注册，3 次 |
| `mmbiz.qpic.cn` + `mp.weixin.qq.com` | 公告页里的公众号文章配图 |

这两类拦掉会省一点流量，但和广告无关，插件里放在「默认注释」的可选段。

---

## 3. 插件的设计依据

| 目标 | 手段 | 理由 |
| --- | --- | --- |
| 掐死开屏广告 | `REJECT` 整个 AdMob 域名族（含 `-cn` 镜像域） | `/mads/gma` 是唯一广告入口，封域名即可，无需改包 |
| 防止聚合兜底补位 | `REJECT` `sdk.e.qq.com`、`gdt.qq.com` | AdMob 失败后会转向优量汇 |
| 顺手止损 | `REJECT` 穿山甲全套（含 `toutiao1`） | 当前不投广告，但每次启动白下 1 MB |
| 不误伤 | 不使用 `googleusercontent.com`、`gstatic.com` 整域 | 这两个域名承载大量正常资源 |

**为什么不用 `[URL Rewrite]`**：域名 `REJECT` 在连接层就把流量掐了，不需要 MITM、不需要装证书、不依赖脚本下载。少一个环节就少一处会坏的地方。

**为什么不用脚本改返回体**：AdMob 的 `/mads/gma` 响应是加密 protobuf（本次 35171 B，首字节随机），无法伪造合法空响应。`get_ads` 同样是加密的。能做的只有"让它拿不到"。

---

## 4. 已知局限与风险

1. **AdMob 是全局域名**。插件拦掉后，你手机里其他用 AdMob 的 App 广告也会一起消失。这是 Loon `[Rule]` 的机制决定的，不按 App 隔离。
2. **可能有第四条链路没抓到**。本次抓包 35 秒，如果 App 还有"激励视频""信息流"广告走别的联盟（例如快手、Mintegral、Unity Ads），这里没有体现。
3. **开屏是否真的被跳过，无法离线验证**。逻辑上 `didFailToReceiveAd` 会让 App 直接跳过，但不排除 App 写死 5 秒倒计时的可能。如果拦截后发现启动变慢，优先怀疑 `sdk.e.qq.com` 的超时等待。
4. **App 更新可能换广告位**。若某天出现新的广告域名，需要重抓。

---

## 5. 复现方法

HAR 里 `encoding: "base64"` 的响应体需要先解码，部分还套了 gzip：

```python
import json, base64, gzip

har = json.load(open("Stream-2026-10-28 054720.har", encoding="utf-8"))
for e in har["log"]["entries"]:
    c = e["response"]["content"]
    raw = base64.b64decode(c["text"]) if c.get("encoding") == "base64" else c["text"].encode()
    try:
        raw = gzip.decompress(raw)
    except Exception:
        pass
    print(e["request"]["url"], len(raw))
```

注意：HAR 的 `entries` 顺序是**倒序**的（第一条 `startedDateTime` 最晚）。

---

## 6. 关键响应原文

**穿山甲 get_ads（证明它没在投广告）**

```json
{"request_id":"755925DF-FDE1-4CF4-9CE6-CBB66C38B6F6",
 "status_code":40006,"reason":0,"desc":"广告位ID不合法"}
```

**AdMob 聚合回执（证明尝试过优量汇）**

```
GET /pagead/interaction/?label=admob_mediation_request_fill_result
    &mediation_fill_status=-3.0.465.-3
    &smc_index=0
```

**AdMob csi 元数据（证明是视频插屏）**

```
j_e_ad_format=js_video_ctd
j_e_layout=video_ctd/interstitial_campari_v7
j_e_cmp_id=24126736259
```

**穿山甲 renderer manifest**

```json
{"name":"ad-pattern-renderer","version":"1.0.2512",
 "main":"https://sf3-fe-tos.pglstatp-toutiao.com/obj/ad-pattern/build/renderer/1.0.0.2512/index.html",
 "resources":[{"url":".../index.js","md5":"47c2294b730ce3a15538251f2cfbe..."}]}
```

---

## 7. 第三轮补充：拦截生效之后

`112_1793138547466.har`，56 条请求，是**启用插件后**的冷启动。

### 7.1 AdMob 请求完全消失

整份 HAR 里 `doubleclick` / `googleads` / `pagead2` 一条都没有，说明规则生效，请求在连接层就被掐掉了（Loon 的 HAR 导出不记录被 REJECT 的连接）。

### 7.2 穿山甲换了个域名：`-b`

```json
POST https://api-access.pangolin-sdk-toutiao-b.com/api/ad/union/sdk/get_ads/
     ?aid=5000546&version_code=5.5.0.7&device_platform=iphone
→ 200 {"request_id":"8734A64A-...","status_code":40006,
        "reason":0,"desc":"广告位ID不合法"}
```

三次抓包见到三个域名：`.com`、`1.com`、`-b.com`。这确认了域名是**按次轮换**的，
`DOMAIN-SUFFIX` 永远追不上，必须用 `DOMAIN-KEYWORD,pangolin-sdk-toutiao`。

### 7.3 App 自己也没广告可用

注意这条：`get_ads` 返回的 `40006` 是**穿山甲服务器**给的业务错误，不是我们拦的。
即使插件不拦这个域名，App 也拿不到穿山甲的广告。

**而「故障」弹窗照样出现了。** 这就证明弹窗的判定标准是「开屏没广告」，
而不是「检测到广告屏蔽软件」——详见 [anti-adblock-dialog.md](anti-adblock-dialog.md)。

### 7.4 新增的非广告流量

| 域名 | 说明 |
| --- | --- |
| `uop.umeng.com` ×3（status 0） | 友盟推送注册，一直失败重试 |
| `alogs.umeng.com/app_logs` | 友盟统计，protobuf |
| `toblog.ctobsnssdk.com/service/2/device_register_only/` | 字节设备注册 |

这些都不是广告，插件未拦截。

