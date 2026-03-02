"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGitStatus = fetchGitStatus;
exports.run = run;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
/** 解析 git status --short 的一行 */
function parseStatusLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    const space = trimmed.indexOf(' ');
    if (space <= 0)
        return null;
    const status = trimmed.slice(0, space).trim();
    const path = trimmed.slice(space).trim();
    return { status, path };
}
function isModifiedOrNew(status) {
    if (status === '??')
        return true;
    if (/M|A/.test(status))
        return true;
    return false;
}
/** 在指定工作区目录执行 git 并返回分支名与修改/新增文件列表 */
function fetchGitStatus(cwd) {
    const branchName = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf-8'
    }).trim();
    const out = (0, child_process_1.execSync)('git status --short', {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
    });
    const lines = out.split(/\r?\n/).filter(Boolean);
    const fileItems = [];
    for (const line of lines) {
        const parsed = parseStatusLine(line);
        if (!parsed)
            continue;
        if (parsed.status === '??' || isModifiedOrNew(parsed.status)) {
            const label = parsed.status === '??' ? '新增' : '修改';
            fileItems.push({ label, path: parsed.path });
        }
    }
    return { branchName, fileItems };
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function buildFilesHtml(fileItems) {
    if (fileItems.length === 0)
        return '<p class="empty">无修改或新增文件</p>';
    return fileItems
        .map((f) => `<li><span class="tag ${f.label === '新增' ? 'new' : 'mod'}">${escapeHtml(f.label)}</span> ${escapeHtml(f.path)}</li>`)
        .join('');
}
/** 构建用于 Review 的 AI 提示词（文件列表 + 请求检查语法） */
function buildReviewPrompt(fileItems) {
    const lines = fileItems.map((f) => `- [${f.label}] ${f.path}`);
    const fileList = lines.join('\n');
    const prompt = `请对以下本次变更中的文件做一次代码审查，重点检查是否有语法错误、明显逻辑错误或风格问题。\n\n文件列表：\n${fileList}\n\n请逐文件简要说明是否存在问题及修改建议。`;
    return prompt;
}
/** Windows 上 agent.ps1 的默认安装路径 */
function getWindowsAgentPs1Path() {
    const localAppData = process.env.LOCALAPPDATA || process.env.USERPROFILE || '';
    return (0, path_1.join)(localAppData, 'cursor-agent', 'agent.ps1');
}
/** Cursor CLI 非交互模式：执行 agent --print 并返回 AI 输出。 */
function runCursorAgentPrint(prompt, cwd) {
    return new Promise((resolve, reject) => {
        const argv = ['--trust', '--print', '--output-format', 'text', '--workspace', cwd, prompt];
        let cmd;
        let args;
        if (process.platform === 'win32') {
            const agentPs1 = getWindowsAgentPs1Path();
            if ((0, fs_1.existsSync)(agentPs1)) {
                cmd = 'powershell';
                args = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', agentPs1, ...argv];
            }
            else {
                cmd = 'agent';
                args = argv;
            }
        }
        else {
            cmd = 'agent';
            args = argv;
        }
        const child = (0, child_process_1.spawn)(cmd, args, {
            cwd,
            shell: false,
            env: { ...process.env }
        });
        const chunks = [];
        const errChunks = [];
        child.stdout.on('data', (b) => chunks.push(b));
        child.stderr.on('data', (b) => errChunks.push(b));
        const timeout = 120000;
        const t = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Agent 执行超时（120 秒）'));
        }, timeout);
        child.on('close', (code, signal) => {
            clearTimeout(t);
            const stdout = Buffer.concat(chunks).toString('utf-8').trim();
            const stderr = Buffer.concat(errChunks).toString('utf-8').trim();
            if (code === 0) {
                resolve(stdout || '(无文本输出)');
            }
            else {
                reject(new Error(stderr || stdout || `退出码 ${code}`));
            }
        });
        child.on('error', (err) => {
            clearTimeout(t);
            if (err.code === 'ENOENT') {
                reject(new Error('未找到 Cursor Agent CLI。请确保已安装 Cursor 并在终端执行过 cursor 或 agent 命令。'));
            }
            else {
                reject(err);
            }
        });
    });
}
/**
 * 提交检测工具：在新界面（Webview）中显示当前分支与修改/新增文件，并提供刷新、Review 按钮
 */
function run() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹');
        return;
    }
    const cwd = folder.uri.fsPath;
    let data;
    try {
        data = fetchGitStatus(cwd);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (String(msg).includes('not a git repository')) {
            vscode.window.showWarningMessage('当前项目不是 Git 仓库');
            return;
        }
        vscode.window.showErrorMessage(`Git 查询失败: ${msg}`);
        return;
    }
    const panel = vscode.window.createWebviewPanel('aicode-tools.commitCheck', `提交检测 - ${data.branchName}`, vscode.ViewColumn.One, { enableScripts: true });
    function updateWebview(result) {
        const branchHtml = escapeHtml(result.branchName);
        const filesHtml = buildFilesHtml(result.fileItems);
        const hasList = result.fileItems.length > 0;
        panel.webview.html = getWebviewContent(branchHtml, filesHtml, hasList);
        panel.title = `提交检测 - ${result.branchName}`;
    }
    updateWebview(data);
    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'refresh') {
            try {
                data = fetchGitStatus(cwd);
                panel.webview.postMessage({
                    type: 'update',
                    branchName: data.branchName,
                    fileItems: data.fileItems
                });
                panel.title = `提交检测 - ${data.branchName}`;
            }
            catch (err) {
                const m = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`刷新失败: ${m}`);
            }
        }
        else if (msg.type === 'review') {
            if (data.fileItems.length === 0) {
                vscode.window.showWarningMessage('当前没有修改或新增文件，无需 Review');
                return;
            }
            const prompt = buildReviewPrompt(data.fileItems);
            panel.webview.postMessage({ type: 'reviewResult', loading: true });
            try {
                const text = await runCursorAgentPrint(prompt, cwd);
                panel.webview.postMessage({ type: 'reviewResult', text });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                const isNoCli = message.includes('未找到 Cursor Agent CLI') || err?.code === 'ENOENT';
                if (isNoCli) {
                    await vscode.env.clipboard.writeText(prompt);
                    panel.webview.postMessage({
                        type: 'reviewResult',
                        fallback: true,
                        message: '未检测到 Cursor Agent CLI（安装时若出现“找不到中央目录结尾记录”多为下载不完整，可重试或换网络）。\n\n已将本次 Review 的提示词复制到剪贴板，请按 Ctrl+L 打开 Cursor AI 对话，粘贴后发送即可。'
                    });
                }
                else {
                    panel.webview.postMessage({ type: 'reviewResult', error: message });
                }
            }
        }
    });
    panel.onDidChangeViewState(() => {
        if (panel.visible) {
            panel.webview.postMessage({
                type: 'update',
                branchName: data.branchName,
                fileItems: data.fileItems
            });
        }
    });
}
function getWebviewContent(branchName, filesHtml, hasList) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; script-src 'unsafe-inline';">
    <title>提交检测</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 16px 20px;
            line-height: 1.6;
        }
        h2 {
            font-size: 1.1em;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: var(--vscode-foreground);
        }
        .branch {
            margin-bottom: 20px;
            padding: 12px 14px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            border-radius: 4px;
        }
        .branch-name { font-weight: 600; color: var(--vscode-textLink-foreground); }
        ul { margin: 0; padding-left: 20px; }
        li { margin: 6px 0; word-break: break-all; }
        .tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-right: 8px;
        }
        .tag.mod {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningBorder);
        }
        .tag.new {
            background: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoBorder);
        }
        .empty { color: var(--vscode-descriptionForeground); margin: 8px 0 0 0; }
        .actions {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-widget-border);
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            cursor: pointer;
            font-size: inherit;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .review-result {
            margin-top: 16px;
            padding: 12px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            max-height: 320px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 0.95em;
        }
        .review-result.loading { color: var(--vscode-descriptionForeground); }
        .review-result.error { color: var(--vscode-errorForeground); }
    </style>
</head>
<body>
    <div class="branch">
        <h2>当前分支</h2>
        <div class="branch-name" id="branchName">${branchName}</div>
    </div>
    <h2>修改 / 新增文件</h2>
    <div id="fileList">${hasList ? `<ul>${filesHtml}</ul>` : filesHtml}</div>
    <div class="actions">
        <button class="btn secondary" id="btnRefresh">刷新</button>
        <button class="btn" id="btnReview">Review</button>
    </div>
    <div class="review-result" id="reviewResult" style="display:none;"></div>
    <script>
        const vscode = acquireVsCodeApi();
        const reviewEl = document.getElementById('reviewResult');
        document.getElementById('btnRefresh').onclick = () => vscode.postMessage({ type: 'refresh' });
        document.getElementById('btnReview').onclick = () => vscode.postMessage({ type: 'review' });
        window.addEventListener('message', e => {
            const msg = e.data;
            if (msg.type === 'update') {
                document.getElementById('branchName').textContent = msg.branchName;
                const list = document.getElementById('fileList');
                if (!msg.fileItems || msg.fileItems.length === 0) {
                    list.innerHTML = '<p class="empty">无修改或新增文件</p>';
                } else {
                    list.innerHTML = '<ul>' + msg.fileItems.map(f =>
                        '<li><span class="tag ' + (f.label === '新增' ? 'new' : 'mod') + '">' + escapeHtml(f.label) + '</span> ' + escapeHtml(f.path) + '</li>'
                    ).join('') + '</ul>';
                }
                return;
            }
            if (msg.type === 'reviewResult') {
                reviewEl.style.display = 'block';
                reviewEl.classList.remove('loading', 'error');
                if (msg.loading) {
                    reviewEl.textContent = '正在调用 AI Review…';
                    reviewEl.classList.add('loading');
                } else if (msg.fallback && msg.message) {
                    reviewEl.textContent = msg.message;
                } else if (msg.error) {
                    reviewEl.textContent = '错误: ' + msg.error;
                    reviewEl.classList.add('error');
                } else {
                    reviewEl.textContent = msg.text || '(无内容)';
                }
            }
        });
        function escapeHtml(s) {
            const div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
}
//# sourceMappingURL=commitCheck.js.map