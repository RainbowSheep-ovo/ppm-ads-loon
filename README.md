# 皮皮喵Lite / 皮皮喵极速版 · Loon 去开屏广告

> 基于三轮真机抓包定位后编写的 Loon 插件，目标是**只去掉开屏广告**，不动其他任何东西。

- **纯域名规则**：不需要 MITM、不需要证书、不依赖远程脚本，装完即生效。
- **只打广告**：不碰书源、书架、阅读、下载相关的任何域名。

---

## ⚠️ 先看这个：拦截会触发 App 的「故障」弹窗

装上后冷启动会弹一个原生弹窗，带 **9 秒倒计时**：

```
故障
无法正常联网，导致广告无法显示！
请升级最新版应用，联网并关闭相关广告屏蔽软件，然后重启应用！
前往设置-更新地址，可下载最新版，如想去广告可以捐赠喵喵特权！
确定(9s)
```

**这是开发商专门做的反广告拦截惩罚，写死在 App 里，Loon 去不掉**（详见 [docs/anti-adblock-dialog.md](docs/anti-adblock-dialog.md)）。

关键证据：第三次抓包里，穿山甲**自己的服务器**返回 `status_code 40006「广告位ID不合法」`——也就是说哪怕你不装插件、App 自己也拿不到广告，这个弹窗照样会弹。它的判定是「开屏没广告」，不是「检测到你装了广告插件」。

于是有了这个尴尬的账：

| 方案 | 开屏广告 | 「故障」弹窗 | 净体验 |
| --- | --- | --- | --- |
| 启用插件 | 无 | 有，9 秒 | 省 5 秒，多付 9 秒 |
| 关闭插件 | 5 秒视频 | 无 | 反而更省时间 |

**所以把这个仓库当技术记录看比较合适。** 是否启用，你自己权衡。

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

三轮抓包拼出来的完整链路：

| 域名 / 接口 | 角色 | 证据 |
| --- | --- | --- |
| `googleads.g.doubleclick-cn.net/mads/gma` | **开屏广告请求** | 返回 35171 B 广告响应体 |
| `.../getconfig/pubsetting` | AdMob 初始化 | `app_name=com.gentle.ppcat-free`、`client=ca-app-pub-5440663071705011`、`admob_appcc=7725269900` |
| `.../mads/static/mad/sdk/native/sdk-core-loader-inline.html` | 广告 WebView 壳 | AdMob SDK `afma-sdk-i-v9.14.0` |
| `pagead2.googlesyndication-cn.com/pcs/activeview` | 曝光打点 | 200 |
| `pagead2.googleadservices-cn.com/pagead/adview` | 广告展示页 | 200 |
| `csi.gstatic.com/csi` | AdMob 性能打点 | 7 次，`layout=interstitial_campari_v7` |
| `sdk.e.qq.com/mediation`、`/launch`、`/event` | **腾讯优量汇**（AdMob 聚合兜底） | `label=admob_mediation_request_fill_result`、`mediation_fill_status=-3.0.465.-3` |
| `api-access.pangolin-sdk-toutiao*.com/.../get_ads/` | 穿山甲拉广告 | 返回 `{"status_code":40006,"desc":"广告位ID不合法"}` |
| `sf*-fe-tos.pglstatp-toutiao.com/obj/ad-pattern/...` | 穿山甲渲染器 | 507 KB × 2，纯浪费 |
| `toblog.ctobsnssdk.com` | 字节 AppLog / 设备注册 | `aid=164362`、`host_appid=5104488`，非广告 |
| `mmbiz.qpic.cn` | 公众号文章配图（公告页） | 非广告 |

插件按上面的顺序分三组拦截：AdMob（主）→ 优量汇（兜底）→ 穿山甲（备用）。

> **穿山甲的域名会轮换**。三次抓包见到三种：
> `.com` / `1.com` / `-b.com`。所以这一版改用 `DOMAIN-KEYWORD,pangolin-sdk-toutiao`，一次覆盖全部以及以后可能出现的新后缀。

---

## 三、三轮抓包踩过的坑

| | 第一轮 | 第二轮 | 第三轮 |
| --- | --- | --- | --- |
| 工具 | Loon | Stream | Loon |
| 请求数 | 35 | 37 | 56 |
| 抓到了什么 | 只有配置拉取和 SDK 初始化 | AdMob 真正投放 | 拦截后的效果 |
| 结论 | 误判成穿山甲 | 定位到 AdMob | 发现反拦截弹窗 |

**坑 1：把「存在」当成「因果」。** 第一轮看到穿山甲 SDK 的初始化请求，就认定广告来自穿山甲。但那只证明"接了这个 SDK"，不证明"广告从它来"。冷启动前 3 秒根本没发出广告请求。

**坑 2：穿山甲的 `get_ads` 一直是失败的。** 返回 `40006 广告位ID不合法`——开发商自己填的广告位 ID 是无效的，它压根没在投广告。拦一个不投广告的 SDK，自然没效果。

**坑 3：`DOMAIN-SUFFIX` 追不上域名轮换。** 先漏了 `toutiao1.com`，改完又漏了 `toutiao-b.com`。改用 `DOMAIN-KEYWORD` 才算完。

---

## 四、常见问题

<details>
<summary><b>为什么弹「故障」弹窗？能去掉吗？</b></summary>

**去不掉。** 它是 App 里的 `UIAlertController`，触发点是广告 SDK 的失败回调，中间没有任何网络请求，Loon 无从下手。详细论证见 [docs/anti-adblock-dialog.md](docs/anti-adblock-dialog.md)。

想不要弹窗，只能不拦广告（关掉插件），或者走官方的「喵喵特权」。
</details>

<details>
<summary><b>装完还是看到开屏广告？</b></summary>

1. **确认冷启动**：从后台划掉 App 再打开，不是切回前台。
2. **关掉其他去广告插件**单独测，避免互相干扰。
3. **确认 AdMob 真的被拦了**：Loon → 仪表盘 → 请求记录，搜 `doubleclick`，应该看到成片的 `REJECT`。
4. 如果仍然出现，说明还有别的链路。请抓一次**广告出现时**的 HAR（从点图标到广告消失），带给我。
</details>

<details>
<summary><b>为什么广告来源是 AdMob，一个国产 App 用 Google？</b></summary>

App 是 `com.gentle.ppcat-free`（免费版），接 AdMob 在国内很常见——广告主出价高，但填充依赖代理网络。你抓包时出口 IP 在香港（`ip-api` 返回 `Kirino LLC`），所以 AdMob 能正常投放。

反过来，如果你**不开代理**直连，AdMob 大概率也拉不到广告——但这只是一种现象，不是可靠的"去广告方法"（而且照样会触发那个故障弹窗）。
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
├── ppm-ads.plugin                  # Loon 插件本体（导入这个，无需其他文件）
├── rules/
│   └── ppm-ads.list                # 纯规则版，可当规则订阅塞进主配置
├── scripts/
│   └── geo-cn.js                   # 可选：ip-api 归属地伪装（默认不启用）
├── docs/
│   ├── har-analysis.md             # 三轮抓包逐条分析
│   └── anti-adblock-dialog.md      # 「故障」弹窗是什么、为什么去不掉
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
