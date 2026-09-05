<p align="center">
  <a href="README.md">English</a> · <a href="README_ZH.md">简体中文</a>
</p>

# Visualink

**把难以消化的技术概念，变成一眼能看懂、可以逐步探索的交互式地图。**

Visualink 是一个帮助所有人理解陌生技术概念的 Agent Skill。你只需要用自己的语言提问，它会给出直接回答、完整视觉地图，以及你可能还不知道该问、但理解全貌所必需的相关概念——对没有技术背景的学习者尤其有帮助。

![Agent Skill](https://img.shields.io/badge/Agent-Skill-7C3AED?style=flat-square)
![输出](https://img.shields.io/badge/输出-单个_HTML-0891B2?style=flat-square)
![主题](https://img.shields.io/badge/主题-Light_%2B_Dark-16A34A?style=flat-square)
[![License: MIT](https://img.shields.io/badge/license-MIT-EA580C?style=flat-square)](LICENSE)

![Visualink：看见概念，理解系统](docs/assets/visualink-hero.svg)

<p align="center">
  <a href="https://jessiedengjie.github.io/Visualink/kubernetes-explained.html"><strong>打开在线 Demo →</strong></a>
  ·
  <a href="#快速开始">安装 Visualink</a>
  ·
  <a href=".cursor/skills/visualink/SKILL.md">查看 Skill</a>
</p>

## 为什么做 Visualink

下面的 Before / After 用一个示例问题 ——「What is Kubernetes?」—— 来说明差异。Visualink 并不局限于 Kubernetes，也不局限于基础设施。

没有这个 Skill 时，你会得到一长串文字。信息是对的，Pod、Node、Cluster、Service 这些词也都在，但你仍然要自己在脑子里把整张图拼出来。

用上 Visualink 之后，同一个问题会变成一张可以扫读、回放、保存的地图。

<table>
<tr>
<td width="50%" valign="top">

## Before

没有 Visualink：一堵文字墙。

![对「What is Kubernetes?」的纯文字回答](docs/assets/why-visualink-before.png)

读完了，却仍然看不清这些部分如何嵌套、谁连向谁、以及这个系统为什么存在。

</td>
<td width="50%" valign="top">

## After

用上 Visualink：一张能留下的图。

![Visualink 把同一个 Kubernetes 问题变成可交互的系统地图](docs/assets/why-visualink-after.png)

同一个问题。现在答案、全貌，以及理解它的路径同时可见。打开 [Kubernetes 在线示例](https://jessiedengjie.github.io/Visualink/kubernetes-explained.html)。

</td>
</tr>
</table>

Kubernetes 只是这里的示范。网络、AI 系统、开发工具，或其他带有组件和流程的概念，都应该得到同样类型的地图。

这就是 Visualink 要改变的体验：

- **先回答问题** —— 用一到两句话说清楚核心概念。
- **先看完整系统** —— 默认展示全貌，而不是一个缺少上下文的局部。
- **从上到下理解** —— 再通过章节逐步进入必要的组成部分、依赖关系和工作流程。
- **补上你不知道该问的问题** —— 主动展示你尚未意识到的组件、边界、连接和相关概念。
- **留下自己的心智模型** —— 可以复制或下载图片，方便复习和分享。

![Visualink 如何把一个问题变成心智模型](docs/assets/visualink-flow.svg)

## 快速开始

### 1. 安装 Skill

使用一条命令安装 Visualink：

```bash
npx skills add jessiedengjie/Visualink
```

安装工具会自动识别支持的 Agent，并把 Skill 放到正确目录。它支持 Cursor、Claude Code、OpenAI Codex，以及其他兼容 Agent Skills 的工具。

<details>
<summary>手动安装</summary>

克隆或下载本仓库，然后把 Skill 复制到 Agent 的个人目录：

- Cursor：`~/.cursor/skills/visualink/`
- Claude Code：`~/.claude/skills/visualink/`
- OpenAI Codex：`~/.agents/skills/visualink/`

```bash
# 请替换成上面列出的目标目录之一。
SKILL_DIR="$HOME/.cursor/skills/visualink"
mkdir -p "$SKILL_DIR"
cp .cursor/skills/visualink/SKILL.md "$SKILL_DIR/SKILL.md"
```

如果只希望在当前项目中使用，请把 Skill 复制到 `.cursor/skills/visualink/`、`.claude/skills/visualink/` 或 `.agents/skills/visualink/`。

[下载打包好的 Skill ZIP](https://github.com/jessiedengjie/Visualink/releases/latest/download/visualink-skill.zip)，可以用于支持上传 Skill 压缩包的 Agent。

</details>

### 2. 直接提问

```text
使用 Visualink 向我解释[一个技术概念]。
假设我没有技术背景。
```

也可以补充自己的工作场景：

```text
我在工作中经常听到[某个技术术语]，但一直不理解它。
使用 Visualink 告诉我它是什么意思、如何工作、和什么相关，
以及为什么这对我的工作很重要。
```

### 3. 打开结果

Visualink 会生成一个独立 HTML 文件并在浏览器中打开。不需要安装前端框架，不需要运行构建流程，也不要求你懂设计或代码。

## 你会得到什么

每个解释器都遵循同一条学习路径：

1. 一到两句话的直接定义
2. 默认完整展示的系统地图
3. 从简单到完整的编号章节
4. 有方向、有动词标签的连接关系
5. 解释结构、邻近概念和存在原因的简短卡片
6. Hover 提示、缩放、拖动和章节播放
7. Light 与 Dark 两套主题
8. 复制图片与下载 PNG

## Visualink 的解释方式

### 先准确，再全面

第一段必须直接回答问题。只有在帮助建立心智模型时，才向外扩展相关概念。

### 画的是系统，不是装饰

节点代表必要角色，外框代表边界与包含关系，箭头具有明确方向和动词标签，颜色在同一语义分类中保持一致。

### 先全貌，再引导

默认视图展示完整系统。章节是理解系统的路径，但不会把某个局部伪装成全部。

### 友好，但不牺牲准确性

使用简单语言和适量比喻帮助入门，同时明确真实技术关系，不编造拓扑、边界或运行行为。

## 在对话中继续调整

你不需要描述 CSS 或 SVG，只需要说出看到的问题：

```text
Dark 模式下最外层的系统边界不够明显。
```

```text
Light 模式可以更明亮，箭头也需要更醒目。
```

```text
先解释核心概念，再展开到它依赖的其他部分。
```

```text
整体看起来太方正，把边角做得柔和一些。
```

Visualink 应该只修改相关部分，保留已经正常工作的交互，并在修改公共样式后同时检查 Light 与 Dark 模式。

## 兼容性

Visualink 使用可移植的 `SKILL.md` Agent Skills 格式。

- **Cursor** —— 支持个人或项目 Skill
- **Claude Code** —— 支持个人或项目 Skill
- **OpenAI Codex** —— 支持个人（`~/.agents/skills`）或仓库（`.agents/skills`）Skill
- **其他 Coding Agent** —— 如果 Agent 能读取本地文件或 GitHub 仓库，可以让它直接使用 [Visualink Skill](.cursor/skills/visualink/SKILL.md)

浏览器视觉检查和图片导出测试取决于 Agent 当前可以使用的工具。

## 仓库结构

```text
Visualink/
├── .cursor/skills/visualink/SKILL.md   # 可复用的 Agent Skill
├── docs/assets/                        # GitHub 引导图片
├── kubernetes-explained.html           # 交互示例 A
├── LICENSE                             # MIT License
├── README.md                           # English onboarding
└── README_ZH.md                        # 中文使用引导
```

## 设计原则

- 从学习者出发，而不是从系统术语出发。
- 只展示理解当前问题所必需的组件。
- 用视觉层级降低认知负担。
- 每一条重要连接都应该有方向和名称。
- 优先交付一个容易打开、保存和分享的独立文件。
- 必须在浏览器里检查真实体验，不能只相信代码。

## 支持 Visualink

如果 Visualink 帮你理解了一个困难概念，可以 [Star 这个仓库](https://github.com/jessiedengjie/Visualink)，方便以后找到它，也欢迎分享你生成的地图。

