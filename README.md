# 🏴‍☠️ 海盗船 3D 交互拆解（Three.js 多文件项目）

基于 **Three.js r160** 的海盗船 3D 交互教学项目：可 360° 环绕观察、透视 / 线框切换、运转动画控制，并能点击 **十大船体部件** 查看结构与功能讲解。在线 GLB 模型加载失败时，会自动降级到内置的**程序化海盗船**（同样包含全部十大部件，离线可用）。

---

## 一、项目结构

```
mode11/
├── index.html      # 页面骨架：画布容器、控制面板、讲解面板、加载遮罩、importmap
├── main.js         # 全部 3D 逻辑：场景/光照/海面、程序化船、GLB加载、交互、动画
├── style.css       # 深色航海风 UI、响应式布局
└── README.md       # 本文档
```

Three.js 通过 CDN `importmap` 引入（`unpkg`），**无需 npm install / 打包工具**。

---

## 二、启动方法

> ⚠️ 不要用 `file://` 直接双击打开 `index.html`——ES Module 的 CORS 限制会导致脚本无法加载。请用本地 HTTP 服务器。

### 方式 1：Python（本机已自带，推荐）

```bash
# 在项目目录下执行
python -m http.server 8765
```

浏览器打开 <http://localhost:8765/index.html>

### 方式 2：Node.js

```bash
npx serve .
# 或
npx http-server -p 8765
```

### 方式 3：VS Code

安装 **Live Server** 扩展 → 右键 `index.html` → `Open with Live Server`。

---

## 三、模型来源与兜底机制

### 加载策略（见 `main.js` 顶部 `MODEL_URLS`）

1. 依次尝试 `MODEL_URLS` 中的在线 `.glb` 地址，单个地址 **6 秒超时**；
2. 任一地址成功 → 自动归一化尺寸、按名称关键字归类到十大部件、播放模型自带动画；
3. 全部失败（断网 / 被墙 / CORS 拒绝 / 404）→ **自动生成内置程序化海盗船**，页面右下角会标注当前模型来源。

### 默认在线地址（示例，可替换）

| 顺序 | 地址 | 说明 |
| --- | --- | --- |
| 1 | `cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb` | Khronos 官方 glTF 示例资产新仓库，jsDelivr CDN，自带 CORS（已实测 200） |
| 2 | `cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/BoomBox/glTF-Binary/BoomBox.glb` | Khronos 旧仓库（默认分支为 `master`），备用镜像 |

> 默认地址为 Khronos 官方 glTF 示例模型（BoomBox），**仅用于验证在线加载链路**，并非真实海盗船。
> 项目的完整海盗船体验由内置程序化模型保证（船首像 / 船桅 / 帆 / 索具 / 炮门 / 甲板 / 船舱 / 船舵 / 锚 / 龙骨 十大部件齐全）。
> 若所在网络无法访问 CDN，页面会在每个地址 6 秒超时后自动进入兜底船（右下角显示当前模型来源）。

### 换成真正的开源海盗船 GLB

1. 从下列站点下载允许商用的 CC0 / CC-BY 海盗船模型，导出为单文件 `.glb`：
   - **Poly Pizza**：<https://poly.pizza/>（大量 CC0 低模，搜 `pirate ship`）
   - **Sketchfab**：<https://sketchfab.com/>（筛选 Downloadable + CC 协议，注意遵守署名要求）
   - **Quaternius**：<https://quaternius.com/>（CC0 资产库）
2. 把模型放到项目 `assets/ship.glb`，或托管到任意带 CORS 的对象存储 / CDN；
3. 修改 `main.js` 顶部：

   ```js
   const MODEL_URLS = ['./assets/ship.glb'];
   ```

4. 若模型网格命名与默认关键字不一致，在 `KEYWORD_MAP` 中补充关键字，即可让点击讲解正确归类；未匹配的网格仍可点击，会显示通用说明。

---

## 四、操作说明

| 操作 | 效果 |
| --- | --- |
| 鼠标左键拖拽 | 360° 环绕旋转船体 |
| 鼠标滚轮 | 拉近 / 拉远（缩放范围受限，防止穿模） |
| 鼠标右键拖拽 | 平移视角 |
| 点击船体部件 | 高亮该部件 + 右侧弹出结构 / 功能讲解 |
| 左侧部件导览 | 点击列表项直接选中并聚焦对应部件 |

### 左侧控制面板

- **⏸ 暂停 / ▶ 播放动画**：控制风帆摆动、船身摇晃、船舵转动、海浪起伏的总开关；
- **动画速度滑块（0.1×–3×）**：实时调节运转动画速率；
- **透视模式开关**：船壳 / 甲板 / 炮门变为半透明，可看穿内部**龙骨与横向隔舱（肋骨）**结构；
- **线框模式开关**：全部材质切换为线框渲染（优先级高于透视模式，可叠加）；
- **🎯 重置视角**：一键回到默认观察机位。

---

## 五、功能与需求对照

| 需求 | 实现位置（`main.js`） |
| --- | --- |
| 轨道控制器（旋转/缩放/平移） | `initScene()` 中 `OrbitControls` |
| 透视 / 线框切换 | `applyRenderMode()`，半透明集合 `XRAY_SEMI` |
| 风帆摆动 / 船舵转动 / 船身摇晃 | `animate()` 中顶点动画 + 舵轮舵叶联动 + 三轴摇晃 |
| 播放暂停 / 调速 | `state.playing`、`state.speed` + UI 事件 |
| 十大部件点击高亮 | `setupPicking()` 射线拾取 + `refreshHighlight()` 自发光高亮 |
| 侧边讲解面板 | `selectObject()` / `openInfo()`，文案见 `PART_INFO` |
| 控制面板 UI | `index.html` + `setupUI()` + `style.css` |
| 环境光 + 方向光阴影 | `setupLights()`（AmbientLight + HemisphereLight + 阴影方向光） |
| 海面背景 / 自适应窗口 | `setupSea()` 顶点波浪海面 + `onResize()` |
| CDN 引入 + 加载失败兜底 | importmap + `loadShip()` 超时降级 `buildProceduralShip()` |

### 十大部件

船首像、船桅、帆、索具、炮门、甲板、船舱（含船壳）、船舵（含舵轮）、锚、龙骨（含隔舱肋骨）。

---

## 六、常见问题

**Q：页面一直停在加载遮罩？**
A：打开浏览器控制台（F12）。若看到 `[模型加载失败]` 属正常现象，6 秒×N 个地址后会自动进入兜底船；若长时间无反应，检查本地服务器是否启动、CDN（unpkg.com）是否被网络拦截。

**Q：想用完全离线环境？**
A：把 `index.html` importmap 中的三个 CDN 路径换成本地下载的 `three.module.js` 与 `addons` 目录，并把 `MODEL_URLS` 清空（`[]`），即直接使用程序化船，运行期零外部请求。

**Q：在线 GLB 点击部件显示"未命名部件"？**
A：该模型命名未命中关键字表，在 `main.js` 的 `KEYWORD_MAP` 对应部件下增加网格名关键字即可。
