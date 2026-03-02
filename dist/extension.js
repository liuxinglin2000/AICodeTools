"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const modules_1 = require("./modules");
const VIEW_ID = 'aicode-tools.mainView';
/** 侧边栏树节点 */
class OptionItem extends vscode.TreeItem {
    constructor(label, optionId) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.optionId = optionId;
        this.command = {
            command: optionId === '1' ? 'aicode-tools.selectOption1' : 'aicode-tools.selectOption2',
            title: this.label
        };
    }
}
/** 侧边栏树数据提供者 */
class MainViewProvider {
    getChildren() {
        return [
            new OptionItem('提交检测工具', '1'),
            new OptionItem('选项2', '2')
        ];
    }
    getTreeItem(element) {
        return element;
    }
}
function activate(context) {
    console.log('AICode Tools 插件已激活');
    const treeDataProvider = new MainViewProvider();
    const treeView = vscode.window.createTreeView(VIEW_ID, {
        treeDataProvider
    });
    const cmd1 = vscode.commands.registerCommand('aicode-tools.selectOption1', modules_1.runOption1);
    const cmd2 = vscode.commands.registerCommand('aicode-tools.selectOption2', modules_1.runOption2);
    context.subscriptions.push(treeView, cmd1, cmd2);
}
function deactivate() {
    console.log('AICode Tools 插件已停用');
}
//# sourceMappingURL=extension.js.map