"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const OUTPUT_CHANNEL_NAME = 'AICode Tools';
/** 解析 git status --short 的一行，返回状态与文件路径 */
function parseStatusLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    // 格式: "XY path" 或 "?? path"，X=暂存区 Y=工作区
    const space = trimmed.indexOf(' ');
    if (space <= 0)
        return null;
    const status = trimmed.slice(0, space).trim();
    const path = trimmed.slice(space).trim();
    return { status, path };
}
/** 状态码是否为“修改或新增”类（用于筛选） */
function isModifiedOrNew(status) {
    if (status === '??')
        return true; // 未跟踪 = 新增
    if (/M|A/.test(status))
        return true; // M=修改 A=新增
    return false;
}
/**
 * 选项1：查询当前项目 Git 本地修改/新增的文件并输出到输出通道
 */
function run() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹');
        return;
    }
    const cwd = folder.uri.fsPath;
    const channel = getOrCreateOutputChannel();
    channel.clear();
    channel.appendLine('=== Git 本地修改/新增文件 ===');
    channel.appendLine(`工作区: ${cwd}`);
    channel.appendLine('');
    try {
        const out = (0, child_process_1.execSync)('git status --short', {
            cwd,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024
        });
        const lines = out.split(/\r?\n/).filter(Boolean);
        const items = [];
        for (const line of lines) {
            const parsed = parseStatusLine(line);
            if (!parsed)
                continue;
            if (parsed.status === '??' || isModifiedOrNew(parsed.status)) {
                items.push(parsed);
            }
        }
        if (items.length === 0) {
            channel.appendLine('(无修改或新增文件)');
        }
        else {
            for (const { status, path } of items) {
                const label = status === '??' ? '新增' : '修改';
                channel.appendLine(`${label}\t${path}`);
            }
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not a git repository')) {
            channel.appendLine('当前文件夹不是 Git 仓库。');
            vscode.window.showWarningMessage('当前项目不是 Git 仓库');
        }
        else {
            channel.appendLine(`执行 git 命令失败: ${msg}`);
            vscode.window.showErrorMessage(`Git 查询失败: ${msg}`);
        }
    }
    channel.show(true);
}
let outputChannel;
function getOrCreateOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    return outputChannel;
}
//# sourceMappingURL=option1.js.map