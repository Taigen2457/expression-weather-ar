# 表情气象 / Expression Weather

摄像头微笑下雨、大笑触发烟花；烟花粒子与跟随头部位置、尺寸和倾斜角的二维椭圆发生反弹。原生 JavaScript + Canvas 2D + MediaPipe Face Landmarker 0.10.21，无框架、无服务端推理。

在线演示：https://expression-weather-ar.taegen.chatgpt.site

公开源码：https://github.com/Taigen2457/expression-weather-ar

## 运行

首次运行先执行 `python3 download_assets.py` 下载固定版本的模型、JS 和 WASM（SHA-256 校验），再从项目根目录执行 `python3 -m http.server 8000`，在电脑上打开 `http://localhost:8000`。移动端必须使用 HTTPS 的在线部署地址；局域网 HTTP 地址不能正常获得摄像头权限。下载依赖后的项目根目录可直接作为 GitHub Pages / Vercel 静态输出目录；Netlify 会按 netlify.toml 自动下载依赖。无需 npm install 或构建。

点击“开启摄像头”并授权。正对镜头、保持光线充足，微笑触发雨；保持微笑并张嘴触发烟花。收起表情后再次大笑可以再次触发。拖动头部可弹开烟花粒子。灵敏度可调整。手动演示明确标注，不代表摄像头识别结果。

## 架构与预算

- 经典 Web Worker 动态导入 ESM 人脸库，保留 WASM loader 所需的 importScripts。CPU 推理独立于动画线程，单人检测，输入宽度 480px。
- 推理最高约 15Hz；按实测推理时长继续降频。同一时刻最多一个在途帧；ImageBitmap 经转移传递并及时 close，无帧队列积压。
- Canvas 使用 requestAnimationFrame，目标跟随显示刷新率，DPR 上限 1.75。粒子对象池硬上限 900，低于 35 FPS 时减少生成预算。
- 笑容左右 blendshape 均值 + jawOpen；100ms EMA 平滑，160/220ms 持续门槛、滞回、1600ms 冷却以及放松后重新触发。张嘴本身不会触发烟花。“大笑”是视觉代理规则，不是对真实情绪或声音的识别。
- 碰撞在头部运动参考系做线段与椭圆的连续相交检测；按法线反射相对速度，再加入头部运动速度。最大步长 1/120 秒，帧间隔封顶 50ms，避免快速穿透和页面恢复后的跳变。O(粒子数)，不做粒子之间两两碰撞。
- 人脸丢失立即停止新特效并清除碰撞体；结果超过 500ms 丢弃，超过 700ms 未返回结果视为跟踪丢失。页面隐藏暂停提交推理、清空特效，关闭时停止所有摄像头轨道并销毁 Worker。
- 不申请麦克风，不录制或上传摄像头画面。在线 Demo 的模型、JS、WASM 均同站部署；源码仓库通过 download_assets.py 还原这些依赖，首次加载约 23MB 文件（包含 SIMD 和兼容文件；浏览器只选其中一组），后续由浏览器缓存策略管理。

## 验证与边界

运行 `node test.mjs` 验证表情状态机、说话代理输入抑制、大笑只触发一次/重新激活、快速穿透拦截、移动头部的推力。运行 `node --check app.mjs` 和 `node --check face-worker.js` 验证语法。

已完成上述代码级验证。当前执行环境未连接真人摄像头，也未完成浏览器端 MediaPipe 初始化、iOS/Android 真机或表情准确率测试，因此不宣称已经通过摄像头实测或达到固定 FPS。建议提交前在桌面 Chrome 和移动端 Safari/Chrome 验收：授权/拒绝/重开、自然说话不误触发、微笑持续下雨、大笑只触发一轮、放松后重触发、头部移动反弹、侧脸/遮挡/离开镜头停止、横竖屏和后台恢复。以页面上的 FPS/推理耗时为现场数据。

这是单目二维碰撞近似；不会重建真实三维头骨、头发轮廓或物理深度。低光、遮挡、夸张侧脸、不同个体的嘴部动作会影响阈值效果，可调灵敏度，但需要真人样本进一步校准。

## 本次纠偏记录（200字以内）

最大陷阱是把 MediaPipe 直接放进模块型 Worker：检查库源码发现其 WASM 加载器调用 importScripts，会导致初始化失败。核心纠偏 Prompt：“改用经典 Worker 内动态导入 ESM，保留 importScripts；只允许一个在途帧，推理降至15Hz，及时释放 ImageBitmap。”已调整线程加载与帧调度；真人摄像头兼容性仍待实测。

## 第三方来源

MediaPipe Tasks Vision 0.10.21（Apache-2.0），模型：Google MediaPipe face_landmarker float16/1。见 `THIRD_PARTY_NOTICES.md`。下载依赖时固定版本，不使用 latest。
