# 好友圈 - Moment Electron

小天才电话手表好友圈桌面客户端，支持 Lite (ADB 数据库读取) 和 Full (V3 API 直连) 两种模式。

## 功能

- 浏览好友圈动态（文字、图片、视频、应用分享）
- Lite 模式：通过 ADB 拉取数据库读取动态（只读）
- Full 模式：V3 API 直连，支持发布动态、点赞、评论
- 自动获取 V3 加密密钥（Frida hook）
- 图片/视频资源展示
- MIUI 风格 UI

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **桌面**: Electron + electron-builder
- **后端**: Python FastAPI + Nuitka (打包为单文件)
- **加密**: xtcv3utils (AES/ECB + GZip + MD5 签名)
- **通信**: Electron preload → HTTP → Python 后端

## 截图

// TODO

## 快速开始

### 前置条件

- Node.js 20+
- Python 3.11+
- ADB (Lite 模式)
- Frida + frida-server (Full 模式密钥获取)
- 已 Root 的小天才电话手表

### 开发

```bash
# 安装前端依赖
npm install

# 安装后端依赖
pip install -r backend/requirements.txt

# 启动开发环境（前端 Vite + Electron）
npm run dev
```

### 打包

```bash
npm run dist
```

## 模式说明

### Lite 模式

通过 ADB 从手表拉取好友圈数据库，解析 SQLite 数据。只能读取，不能发送。

### Full 模式

通过 V3 API 直连服务器，速度快，完整功能支持。需要先获取 V3 加密密钥：

1. 在手表上运行 Frida server
2. 在设置页点击「自动获取密钥」
3. 按提示在手表上操作触发密钥更新
4. 密钥会自动保存到配置文件

## 配置

配置文件位于 `~/.moment/config.json`：

```json
{
  "mode": "full",
  "full": {
    "aes_key": "",
    "eebbk_key": "",
    "key_id": "",
    "watch_id": "",
    "device_id": "",
    "token": "",
    "mac": ""
  }
}
```

## 免责声明

本项目仅供学习研究使用，请遵守相关法律法规。
