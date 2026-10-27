# 皮皮喵极速版 · Loon 去广告插件

> 基于真机抓包（Loon 导出的 HAR）分析后编写的 Loon 插件，用于去掉 **皮皮喵极速版 / 皮皮喵Lite（iOS）** 中的开屏、插屏、信息流与激励视频广告。

- **纯规则实现**：不含远程 JS 脚本，不依赖 `raw.githubusercontent.com` 的可用性，断网重连也不会"脚本下载失败"。
- **精准打击**：只拦该 App 真正用到的广告链路（穿山甲 Pangle / CSJUnion），不做"整域大扫除"。

---

## 一、安装

### 方式 A：一键导入（推荐）

在 iPhone 上点下面的链接，Loon 会自动识别并弹出导入窗口。

**通用链接**（微信/浏览器/App 里都能点）：

https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FRainbowSheep-ovo%2Fppm-ads-loon%2Fmain%2Fppm-ads.plugin

**直达链接**（只有一个 `loon://` 超链接，在上面那条点不开时用）：

```
loon://import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FRainbowSheep-ovo%2Fppm-ads-loon%2Fmain%2Fppm-ads.plugin
```

### 方式 B：手动添加

1. 复制插件地址：

   ```
   https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
   ```

2. 打开 Loon → 底部 **配置** → **插件** → 右上角 **+** → 粘贴地址 → 保存。
3. 确认插件开关为**开启**状态。

### 方式 C：访问不了 GitHub 时

任选一个镜像地址，内容与主仓库一致：

```
https://cdn.jsdelivr.net/gh/RainbowSheep-ovo/ppm-ads-loon@main/ppm-ads.plugin
https://ghproxy.net/https://raw.githubusercontent.com/RainbowSheep-ovo/ppm-ads-loon/main/ppm-ads.plugin
```

### 方式 D：只要规则，不要插件

不想用插件、想把规则并进自己的主配置或规则组，可用纯规则版：

```
loon://import?rules=https%3A%2F%2Fraw.githubusercontent.com%2FRainbowSheep-ovo%2Fppm-ads-loon%2Fmain%2Frules%2Fpangle-ads.list
```

### 安装后必做

- **开启全局 MITM**：Loon → 配置 → MITM → 打开「MitM 总开关」，并按提示安装 + 信任证书。
  > 不开启也能用：域名 `REJECT` 规则不需要解密，**广告照样会被拦掉**；只是「试玩广告组件」那两条 URL Rewrite 不生效而已。
- **杀掉 App 后重开**：穿山甲 SDK 会缓存已下发的广告素材，冷启动一次才会走新的网络请求。

---

## 二、它到底拦了什么

抓包显示，该 App 的广告链路是**字节跳动「穿山甲」SDK（iOS v5.5.0.7，appid `5000546`）**，冷启动时会依次请求：

| 域名 | 作用 | 处理 |
| --- | --- | --- |
| `api-access.pangolin-sdk-toutiao.com` | **广告拉取接口** `get_ads` | 域名 REJECT |
| `*.pangle.io` | 广告素材 CDN | 域名 REJECT |
| `*.pglstatp-toutiao.com` | 曝光/点击上报 | 域名 REJECT |
| `mssdk.volces.com` | SDK 埋点上报（单次 POST 可达 2.8 KB） | 域名 REJECT |
| `tnc3-alisc1.zijieapi.com` 等 | TTNet **HTTP-DNS**，会给 App 下发广告服务器 IP | 域名 REJECT |
| `lf-cdn-tos.bytescm.com/obj/static/ad/...` | 试玩广告（Playable）组件 | URL Rewrite → 空 200 |

其中最关键的是 `api-access.pangolin-sdk-toutiao.com/api/ad/union/sdk/get_ads`——这是**唯一的广告请求接口**，请求体是加密 protobuf。既然无法伪造返回体，就直接在连接层掐断：SDK 拿不到广告，原生地走"无广告填充（no fill）"分支，不会弹错误框。

> 完整抓包逐条分析见 [docs/har-analysis.md](docs/har-analysis.md)。

---

## 三、常见问题

<details>
<summary><b>装了插件还有广告？</b></summary>

按可能性排序：

1. **没重启 App**。穿山甲会把广告素材缓存在本地沙盒，最长可达数小时。请从后台彻底划掉 App 再打开。
2. **那不是 SDK 广告，而是 App 内置的「推广/公告」**。皮皮喵极速版的部分推广位是服务器下发的加密数据包（`datas/app_ios_store_free`），不走网络请求广告，因此任何基于抓包的规则都拦不到。这类内容只能靠 App 更新或改数据包解决。
3. **广告由别的联盟提供**（如优量汇、快手）。本插件只覆盖抓包里实际出现的链路；如果你抓到了新的广告域名，欢迎提 Issue 并附上 HAR。
</details>

<details>
<summary><b>会影响其他 App 吗？</b></summary>

会，而且是**全局**的：Loon 的 `[Rule]` 不区分 App。穿山甲是国内最大的广告 SDK 之一，微信、抖音、各类工具 App 里的穿山甲广告也会一并消失——对绝大多数用户来说是好事。

如果你只想拦截皮皮喵、不想影响其他 App，可以把插件里除「试玩广告 Rewrite」外的规则删掉，改用 `[URL Rewrite]` 的 `reject-200` 精准拦截（需要 MITM，且只对该 App 发起的请求生效……但要说明：Loon 的 Rewrite 同样是全局 URL 匹配，并非按 App 隔离，只是匹配规则更窄）。
</details>

<details>
<summary><b>会不会影响皮皮喵的正常功能？</b></summary>

不会。书源、书架、阅读、下载走的是 `mwfimsvfast9.cc` 之类的书源域名和数据镜像（`dev.azure.com` / `gitlab.com`），与广告域名完全无关。插件没有改动任何业务接口的返回内容。
</details>

<details>
<summary><b>要不要开「全局代理」？</b></summary>

不需要。规则模式下（分流）即可正常工作，`REJECT` 是本机行为，流量不会出网。
</details>

<details>
<summary><b>为什么没有 JS 脚本？</b></summary>

因为**没有可改的东西**：`get_ads` 的请求体和响应体都是穿山甲私有加密 protobuf，伪造返回值不可行；能做的只有"让它拉不到"。少一个脚本 = 少一个失败点（脚本下载失败、超时、运行时版本不兼容）。
</details>

---

## 四、仓库结构

```
.
├── ppm-ads.plugin          # Loon 插件本体（导入这个，无需其他文件）
├── rules/
│   └── pangle-ads.list     # 纯规则版，可当规则订阅塞进主配置
├── scripts/
│   └── geo-cn.js           # 可选：ip-api 归属地伪装（默认不启用，见分析文档 4.2）
├── docs/
│   └── har-analysis.md     # 抓包逐条分析 + 结论 + 已知局限
├── LICENSE
└── README.md
```

---

## 五、参考

- [Loon 官方文档 · 插件](https://nsloon.app/docs/Plugin/)
- [Loon 官方文档 · 复写（Rewrite）](https://nsloon.app/docs/Rewrite/)
- [Loon 插件示例](https://github.com/Loon0x00/LoonExampleConfig)

## 六、免责声明

本项目仅用于**个人学习与网络流量分析**，不对 App 做任何破解、去壳或修改。请支持开发者，若觉得好用请购买正版 / 会员。因使用本插件产生的任何后果由使用者自行承担。

## License

[MIT](LICENSE)
