# 皮皮喵Lite / 皮皮喵极速版 · Loon 去开屏广告

> 基于两轮真机抓包定位后编写的 Loon 插件，目标是**只去掉开屏广告**，不动其他任何东西。

**核心结论**：这个 App 的开屏广告来自 **Google AdMob**，不是穿山甲。第一版插件只拦了穿山甲（`pangle.io` / `pangolin-sdk-toutiao.com`），所以完全没生效——详见 [为什么第一版没生效](#三为什么第一版完全没生效复盘)。

- **纯域名规则**：不需要 MITM、不需要证书、不依赖远程脚本，装完即生效。
- **只打广告**：不碰书源、书架、阅读、下载相关的任何域名。

---

## 一、安装

### 方式 A：复制地址，粘进 Loon（推荐，最不容易失败）

复制这一行：

```
https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
```

然后：Loon → 底部 **配置** → **插件** → 右上角 **+** → 粘贴 → 保存 → 打开开关。

### 方式 B：一键导入链接

有的浏览器 / 微信内置浏览器会拦截自定义 scheme，点了没反应属正常，直接用方式 A。

通用链接：

https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FRainbowSheep-ovo%2Fppm-ads-loon%2Fmain%2Fppm-ads.plugin

直达链接：

```
loon://import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FRainbowSheep-ovo%2Fppm-ads-loon%2Fmain%2Fppm-ads.plugin
```

### 方式 C：GitHub 打不开时（国内镜像，均已实测可拉到同一份文件）

任选一条，用方式和 A 一样——复制、粘进 Loon 的插件地址栏：

```
https://gh-proxy.com/https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
```

```
https://ghproxy.net/https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
```

```
https://cdn.statically.io/gh/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
```

```
https://cdn.jsdelivr.net/gh/RainbowSheep-ovo/ppm-ads-loon@main/ppm-ads.plugin
```

### 方式 D：只要规则，不要插件

```
https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/rules/ppm-ads.list
```

添加方式：Loon → 配置 → 规则 → 添加规则订阅 → 粘贴上面的地址 → 订阅策略选 `REJECT`。

### 安装后必做

**从后台彻底划掉皮皮喵再重开。** 开屏广告是冷启动时才请求的，不重开可能还是看缓存。

---

## 二、它到底拦了什么

第二次抓包（`.har`，37 条请求）已经把链路拍得很清楚：

| 域名 / 接口 | 角色 | 证据 |
| --- | --- | --- |
| `googleads.g.doubleclick-cn.net/mads/gma` | **开屏广告请求** | 返回 35171 B 广告响应体 |
| `.../getconfig/pubsetting` | AdMob 初始化 | `app_name=com.gentle.ppcat-free`、`client=ca-app-pub-5440663071705011`、`admob_appcc=7725269900` |
| `.../mads/static/mad/sdk/native/sdk-core-loader-inline.html` | 广告 WebView 壳 | AdMob SDK `afma-sdk-i-v9.14.0` |
| `pagead2.googlesyndication-cn.com/pcs/activeview` | 曝光打点 | 200 |
| `pagead2.googleadservices-cn.com/pagead/adview` | 广告展示页 | 200 |
| `csi.gstatic.com/csi` | AdMob 性能打点 | 7 次，`layout=interstitial_campari_v7` |
| `sdk.e.qq.com/mediation`、`/launch`、`/event` | **腾讯优量汇**（AdMob 聚合兜底） | `label=admob_mediation_request_fill_result`、`mediation_fill_status=-3.0.465.-3`（这次没填上） |
| `api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/get_ads/` | 穿山甲拉广告 | 返回 `{"status_code":40006,"desc":"广告位ID不合法"}` |
| `api-access.pangolin-sdk-toutiao**1**.com/...` | 穿山甲备用域名 | **多一个 `1`**，第一版就是漏在这里 |
| `sf3/sf6-fe-tos.pglstatp-toutiao.com/obj/ad-pattern/...` | 穿山甲渲染器 | 507 KB × 2，纯浪费 |
| `toblog.ctobsnssdk.com` | 字节 AppLog / 设备注册 | `aid=164362`、`host_appid=5104488`，非广告 |
| `mmbiz.qpic.cn` | 公众号文章配图（公告页） | 非广告 |

插件按上面的顺序分三组拦截：AdMob（主）→ 优量汇（兜底）→ 穿山甲（备用）。

---

## 三、为什么第一版完全没生效（复盘）

第一版只写了穿山甲相关的域名，实测无效。现在有数据，原因有三条：

1. **真正的广告来自 AdMob**。第一次抓包只抓了冷启动前 3 秒，AdMob 那条 `/mads/gma` 还没发出来，所以完全没被看见。
2. **穿山甲的 `get_ads` 本来就是失败的**——返回 `40006 广告位ID不合法`。也就是说 App 里填的穿山甲广告位 ID 是无效的，它压根没在投广告。拦一个本来就不投广告的 SDK，当然没效果。
3. **域名写漏了一个字符**。穿山甲有两个域名：

   ```
   api-access.pangolin-sdk-toutiao.com     ← 第一版拦的
   api-access.pangolin-sdk-toutiao1.com    ← 实际在用的（多一个 1）
   ```

   `DOMAIN-SUFFIX,pangolin-sdk-toutiao.com` 匹配不到 `...toutiao1.com`，因为它不是以 `.pangolin-sdk-toutiao.com` 结尾。

这一版已全部修正。

---

## 四、常见问题

<details>
<summary><b>装完还是看到开屏广告？</b></summary>

1. **确认冷启动**：从后台划掉 App 再打开，不是切回前台。
2. **确认没有别的去广告插件打架**：你之前提到开过其他插件。两个插件同时改同一批域名时，先禁用其他插件单独测这一版。
3. **确认 AdMob 真的被拦了**：Loon → 仪表盘 → 请求记录，搜 `doubleclick`，应该看到大量 `REJECT`。
4. 如果仍然出现，说明还有第四条链路没抓到。请抓一次**广告出现时**的 HAR（从点图标到广告消失），带给我。
</details>

<details>
<summary><b>为什么广告来源是 AdMob，一个国产 App 用 Google？</b></summary>

App 是 `com.gentle.ppcat-free`（免费版），接 AdMob 在国内很常见——广告主出价高、填充率依赖代理网络。你抓包时出口 IP 在香港（`ip-api` 返回 `Kirino LLC`），所以 AdMob 能正常投放。

反过来，如果你**不开代理**直连，AdMob 大概率也拉不到广告——但这只是一种现象，不是可靠的"去广告方法"。
</details>

<details>
<summary><b>会不会影响 App 正常功能？</b></summary>

不会。插件只拦广告域名，书源、书架、阅读、下载走的是 Azure/GitLab 镜像和书源站，与这些域名无关。

唯一需要留意的是 `doubleclick.net` 这类域名是**全局**生效的——如果你手机里还有别的 App 用 AdMob，它们的广告也会一起消失。这通常是好事。
</details>

<details>
<summary><b>要开 MITM / 装证书吗？</b></summary>

**不需要。** 这一版全是 `[Rule]` 域名拦截，走的是连接层，不解密任何流量。上一版有两条 `[URL Rewrite]`，这版已经删掉了。
</details>

<details>
<summary><b>拦截后开屏会不会卡住？</b></summary>

AdMob SDK 在连接被拒绝时会走 `didFailToReceiveAd` 回调，App 随即跳过开屏。理论上不会卡；如果发现启动变慢或白屏时间变长，删掉 `sdk.e.qq.com` 那条再试（它是聚合兜底，有时会等超时）。
</details>

---

## 五、仓库结构

```
.
├── ppm-ads.plugin          # Loon 插件本体（导入这个，无需其他文件）
├── rules/
│   └── ppm-ads.list        # 纯规则版，可当规则订阅塞进主配置
├── scripts/
│   └── geo-cn.js           # 可选：ip-api 归属地伪装（默认不启用）
├── docs/
│   └── har-analysis.md     # 两轮抓包逐条分析
├── LICENSE
└── README.md
```

---

## 六、参考

- [Loon 官方文档 · 插件](https://nsloon.app/docs/Plugin/)
- [Loon 官方文档 · 规则](https://nsloon.app/docs/Rule/)
- [Google AdMob 移动广告 SDK 请求路径说明](https://developers.google.com/admob/ios/quick-start)

## 七、免责声明

本项目仅用于**个人学习与网络流量分析**，不对 App 做任何破解、去壳或修改。请支持开发者，若觉得好用请购买正版 / 会员。因使用本插件产生的任何后果由使用者自行承担。

## License

[MIT](LICENSE)
