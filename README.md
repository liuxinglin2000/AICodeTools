# AICode Tools

一个基础的 Cursor / VS Code 插件示例。

## 功能

- 注册了一个命令：**AICode Tools: 你好世界**
- 执行后会在编辑器右下角显示一条提示消息。

## 开发环境准备

1. 安装依赖：

```bash
npm install
```

2. 编译 TypeScript：

```bash
npm run compile
```

## 如何“导入”并运行插件

Cursor 和 VS Code 使用同一套扩展 API，插件可以按下面两种方式使用。

### 方式一：在开发中直接运行（推荐用于调试）

1. 用 **Cursor** 或 **VS Code** 打开本项目文件夹 `AICodeTools`。
2. 按 **F5**（或菜单：运行 → 启动调试）。
3. 会弹出一个新的“扩展开发主机”窗口，里面已经加载了当前插件。
4. 在新窗口中按 **Ctrl+Shift+P**（Mac：Cmd+Shift+P），输入 `AICode Tools` 或 `你好世界`，选择 **AICode Tools: 你好世界** 并执行。
5. 若一切正常，右下角会弹出提示：“你好！来自 AICode Tools 的问候～”。

### 方式二：安装为本地扩展（长期使用）

1. 在项目根目录执行编译（若未编译过）：

```bash
npm run compile
```

2. 在 Cursor / VS Code 中：
   - 按 **Ctrl+Shift+X**（Mac：Cmd+Shift+X）打开扩展视图。
   - 点击右上角 **...**，选择 **从 VSIX 安装...**（若已打包成 .vsix），  
     或者选择 **从文件夹安装...**（若支持的话）。
3. 若使用“从文件夹安装”（部分版本支持）：
   - 选择本项目的根目录（即包含 `package.json` 和 `dist` 的 `AICodeTools` 文件夹）。
   - 安装后重启 Cursor / VS Code，即可在命令面板中使用 **AICode Tools: 你好世界**。
   - 若不支持该选项，请用下面的“打包成 .vsix”方式安装。

### 打包成 .vsix（可选，便于分享或从 VSIX 安装）

1. 安装打包工具：

```bash
npm install -g @vscode/vsce
```

2. 在项目根目录执行：

```bash
vsce package
```

3. 会生成 `aicode-tools-0.1.0.vsix`，在扩展视图中选择 **从 VSIX 安装...** 并选中该文件即可安装。

## 项目结构

```
AICodeTools/
├── package.json       # 插件清单（名称、命令、入口等）
├── tsconfig.json      # TypeScript 配置
├── src/
│   └── extension.ts  # 插件入口，注册命令与逻辑
├── dist/             # 编译后的 JS（npm run compile 后生成）
├── .vscode/
│   └── launch.json   # F5 启动“扩展开发主机”的配置
└── README.md
```

## 修改代码后

- 若用 **F5** 调试：改完 `src/extension.ts` 后重新执行一次 `npm run compile`，再在新开的扩展主机窗口里重新执行命令即可（或重新 F5 启动）。
- 若已“从文件夹安装”：在项目里执行 `npm run compile` 后，重启 Cursor / VS Code，或重新加载窗口（命令面板中执行“开发人员: 重新加载窗口”）。
